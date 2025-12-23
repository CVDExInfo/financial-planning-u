// services/finanzas-api/src/handlers/materializeWorker.ts
import { SQSEvent } from "aws-lambda";
import { materializeRubrosForBaseline, materializeAllocationsForBaseline } from "../lib/materializers";
import { logDataHealth } from "../lib/dataHealth";
import { ddb, tableName, UpdateCommand, GetCommand, QueryCommand } from "../lib/dynamo";

async function fetchBaselinePayload(baselineId: string) {
  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: tableName("prefacturas"),
        Key: { pk: `BASELINE#${baselineId}`, sk: "METADATA" },
      })
    );
    return result.Item;
  } catch (error) {
    console.error("Failed to fetch baseline payload", { baselineId, error });
    return null;
  }
}

// Labor category classification constants
const LABOR_CATEGORY_PATTERNS = ['labor', 'mod', 'mano de obra', 'workforce'];
const LABOR_TYPE_PATTERNS = ['labor', 'mod'];

async function countRubros(projectId: string, baselineId: string): Promise<{ total: number; labor: number; nonLabor: number }> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("rubros"),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
        FilterExpression: "baselineId = :baselineId",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
          ":skPrefix": `RUBRO#`,
          ":baselineId": baselineId,
        },
      })
    );
    
    const items = result.Items || [];
    const labor = items.filter(item => {
      const category = (item.category || '').toLowerCase();
      const type = (item.type || '').toLowerCase();
      
      // Check if category or type matches any labor patterns
      return LABOR_CATEGORY_PATTERNS.some(pattern => category.includes(pattern)) ||
             LABOR_TYPE_PATTERNS.some(pattern => type.includes(pattern));
    }).length;
    const nonLabor = items.length - labor;
    
    return { total: items.length, labor, nonLabor };
  } catch (error) {
    console.error("Failed to count rubros", { projectId, baselineId, error });
    return { total: 0, labor: 0, nonLabor: 0 };
  }
}

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records || []) {
    const now = new Date().toISOString();
    try {
      const body = JSON.parse(record.body);
      const { baselineId, projectId } = body;
      
      // Fetch baseline payload
      const baseline = await fetchBaselinePayload(baselineId);
      if (!baseline) {
        await logDataHealth({ 
          projectId, 
          baselineId, 
          type: 'materialize_missing_baseline', 
          message: 'Baseline not found' 
        });
        continue;
      }
      
      // Update baseline to processing state
      try {
        await ddb.send(new UpdateCommand({
          TableName: tableName("prefacturas"),
          Key: { pk: `BASELINE#${baselineId}`, sk: 'METADATA' },
          UpdateExpression: 'SET materialization_status = :processing',
          ExpressionAttributeValues: { ':processing': 'processing' }
        }));
      } catch (updateErr) {
        console.warn("Failed to set processing status", updateErr);
      }
      
      // Materialize rubros and allocations
      const [rubrosSummary, allocationsSummary] = await Promise.all([
        materializeRubrosForBaseline(baseline, { dryRun: false }),
        materializeAllocationsForBaseline(baseline, { dryRun: false })
      ]);
      
      // Count rubros and categorize by type
      const rubrosCount = await countRubros(projectId, baselineId);
      
      // Update baseline with materialization metadata
      await ddb.send(new UpdateCommand({
        TableName: tableName("prefacturas"),
        Key: { pk: `BASELINE#${baselineId}`, sk: 'METADATA' },
        UpdateExpression: 'SET materializedAt = :now, materialization_status = :completed, rubrosCount = :count, rubrosByType = :types',
        ExpressionAttributeValues: { 
          ':now': now,
          ':completed': 'completed',
          ':count': rubrosCount.total,
          ':types': { labor: rubrosCount.labor, nonLabor: rubrosCount.nonLabor }
        }
      }));
      
      console.log('Successfully materialized baseline', { 
        baselineId, 
        projectId, 
        rubrosWritten: rubrosSummary.rubrosWritten || 0,
        rubrosSkipped: rubrosSummary.rubrosSkipped || 0,
        allocationsWritten: allocationsSummary.allocationsWritten || 0,
        rubrosCountTotal: rubrosCount.total,
        rubrosCountByType: rubrosCount
      });
    } catch (err) {
      console.error('materialize worker error', err);
      
      // Try to update baseline to failed state
      try {
        const body = JSON.parse(record.body);
        const { baselineId } = body;
        if (baselineId) {
          await ddb.send(new UpdateCommand({
            TableName: tableName("prefacturas"),
            Key: { pk: `BASELINE#${baselineId}`, sk: 'METADATA' },
            UpdateExpression: 'SET materialization_status = :failed, materializationError = :error',
            ExpressionAttributeValues: { 
              ':failed': 'failed',
              ':error': String(err)
            }
          }));
        }
      } catch (updateErr) {
        console.error('Failed to update baseline to failed state', updateErr);
      }
      
      await logDataHealth({ 
        type: 'materialize_worker_error', 
        message: String(err) 
      });
      throw err; // let lambda retry per DLQ policy
    }
  }
};

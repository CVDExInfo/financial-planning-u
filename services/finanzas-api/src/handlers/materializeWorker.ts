// services/finanzas-api/src/handlers/materializeWorker.ts
import { SQSEvent } from "aws-lambda";
import { materializeRubrosForBaseline, materializeAllocationsForBaseline } from "../lib/materializers";
import { logDataHealth } from "../lib/dataHealth";
import { ddb, tableName } from "../lib/dynamo";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

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

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records || []) {
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
      
      // Materialize rubros and allocations
      await Promise.all([
        materializeRubrosForBaseline(baseline, { dryRun: false }),
        materializeAllocationsForBaseline(baseline, { dryRun: false })
      ]);
      
      console.log('Successfully materialized baseline', { baselineId, projectId });
    } catch (err) {
      console.error('materialize worker error', err);
      await logDataHealth({ 
        type: 'materialize_worker_error', 
        message: String(err) 
      });
      throw err; // let lambda retry per DLQ policy
    }
  }
};

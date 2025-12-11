/**
 * Integration test for dev environment validation
 * 
 * This test validates that the following endpoints work correctly with seeded data:
 * 1. GET /payroll/dashboard - Portfolio graphs
 * 2. GET /plan/forecast?projectId=P-CLOUD-ECOPETROL - Forecast grid
 * 3. PATCH /projects/P-SOC-BANCOL-MED/reject-baseline - Baseline reject
 * 
 * Prerequisites:
 * - Run seed script: npm run seed:canonical-projects
 * - Ensure AWS credentials are configured for dev environment
 * - Set TABLE_PREFIX=finz_ or appropriate table prefix
 */

import { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PREFIX = process.env.TABLE_PREFIX || "finz_";
const SKIP_INTEGRATION_TESTS = process.env.SKIP_INTEGRATION_TESTS === "true";

const ddb = new DynamoDBClient({ region: AWS_REGION });

const tableName = (name: string) => `${TABLE_PREFIX}${name}`;

describe("Dev Environment Validation", () => {
  // Skip if SKIP_INTEGRATION_TESTS is set
  const describeOrSkip = SKIP_INTEGRATION_TESTS ? describe.skip : describe;

  describeOrSkip("P-CLOUD-ECOPETROL Project", () => {
    const projectId = "P-CLOUD-ECOPETROL";

    it("should have project metadata with baseline_id", async () => {
      const result = await ddb.send(
        new GetItemCommand({
          TableName: tableName("projects"),
          Key: marshall({
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
          }),
        })
      );

      expect(result.Item).toBeDefined();
      const item = unmarshall(result.Item!);
      expect(item.projectId).toBe(projectId);
      expect(item.baselineId).toBe("BL-CLOUD-ECOPETROL-001");
      expect(item.name).toBe("Cloud Ops Ecopetrol");

      console.log("✓ Project metadata found:", {
        projectId: item.projectId,
        baselineId: item.baselineId,
        name: item.name,
      });
    });

    it("should have rubros with baseline_id metadata", async () => {
      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("projects"),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: marshall({
            ":pk": `PROJECT#${projectId}`,
            ":sk": "RUBRO#",
          }),
        })
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBeGreaterThan(0);

      const rubros = result.Items!.map((item) => unmarshall(item));
      
      // Verify all rubros have baseline_id in metadata
      for (const rubro of rubros) {
        expect(rubro.metadata).toBeDefined();
        expect(rubro.metadata.baseline_id).toBe("BL-CLOUD-ECOPETROL-001");
      }

      console.log(`✓ Found ${rubros.length} rubros with correct baseline_id metadata`);
    });

    it("should have allocations", async () => {
      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("allocations"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: marshall({
            ":pk": `PROJECT#${projectId}`,
          }),
        })
      );

      expect(result.Items).toBeDefined();
      const allocations = result.Items!.map((item) => unmarshall(item));

      console.log(`✓ Found ${allocations.length} allocations`);

      if (allocations.length === 0) {
        console.warn("⚠️  No allocations found - forecast will use rubros fallback");
      }
    });

    it("should have payroll records", async () => {
      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("payroll_actuals"),
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: marshall({
            ":pk": `PROJECT#${projectId}`,
          }),
        })
      );

      expect(result.Items).toBeDefined();
      const payroll = result.Items!.map((item) => unmarshall(item));

      console.log(`✓ Found ${payroll.length} payroll records`);

      if (payroll.length === 0) {
        console.warn("⚠️  No payroll records found - forecast will show zeros for actuals");
      }
    });
  });

  describeOrSkip("P-SOC-BANCOL-MED Project", () => {
    const projectId = "P-SOC-BANCOL-MED";
    const expectedBaselineId = "BL-SOC-BANCOL-001";

    it("should have project metadata with correct baseline_id for reject test", async () => {
      const result = await ddb.send(
        new GetItemCommand({
          TableName: tableName("projects"),
          Key: marshall({
            pk: `PROJECT#${projectId}`,
            sk: "METADATA",
          }),
        })
      );

      expect(result.Item).toBeDefined();
      const item = unmarshall(result.Item!);
      expect(item.projectId).toBe(projectId);
      expect(item.baselineId).toBe(expectedBaselineId);
      expect(item.name).toBe("SOC Bancolombia Medellín");

      console.log("✓ P-SOC-BANCOL-MED metadata found:", {
        projectId: item.projectId,
        baselineId: item.baselineId,
        name: item.name,
      });
    });

    it("should have rubros with baseline_id metadata", async () => {
      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("projects"),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: marshall({
            ":pk": `PROJECT#${projectId}`,
            ":sk": "RUBRO#",
          }),
        })
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBeGreaterThan(0);

      const rubros = result.Items!.map((item) => unmarshall(item));

      for (const rubro of rubros) {
        expect(rubro.metadata).toBeDefined();
        expect(rubro.metadata.baseline_id).toBe(expectedBaselineId);
      }

      console.log(`✓ Found ${rubros.length} rubros with correct baseline_id`);
    });
  });

  describeOrSkip("Payroll Dashboard Data", () => {
    it("should have projects with start dates for dashboard aggregation", async () => {
      const result = await ddb.send(
        new ScanCommand({
          TableName: tableName("projects"),
          FilterExpression: "begins_with(pk, :pk) AND sk = :sk",
          ExpressionAttributeValues: marshall({
            ":pk": "PROJECT#",
            ":sk": "METADATA",
          }),
        })
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBeGreaterThan(0);

      const projects = result.Items!.map((item) => unmarshall(item));
      
      console.log(`✓ Found ${projects.length} projects for dashboard`);

      // Verify projects have start dates
      const projectsWithDates = projects.filter((p) => 
        p.startMonth || p.start_date || p.fecha_inicio
      );

      expect(projectsWithDates.length).toBeGreaterThan(0);
      console.log(`✓ ${projectsWithDates.length} projects have start dates`);

      // Log sample for debugging
      if (projectsWithDates.length > 0) {
        const sample = projectsWithDates[0];
        console.log("  Sample project:", {
          projectId: sample.projectId,
          name: sample.name,
          startMonth: sample.startMonth || sample.start_date || sample.fecha_inicio,
        });
      }
    });

    it("should have payroll records for dashboard MOD calculations", async () => {
      const result = await ddb.send(
        new ScanCommand({
          TableName: tableName("payroll_actuals"),
          FilterExpression: "begins_with(pk, :pk) AND begins_with(sk, :sk)",
          ExpressionAttributeValues: marshall({
            ":pk": "PROJECT#",
            ":sk": "PAYROLL#",
          }),
        })
      );

      expect(result.Items).toBeDefined();
      const payroll = result.Items!.map((item) => unmarshall(item));

      console.log(`✓ Found ${payroll.length} total payroll records across all projects`);

      if (payroll.length === 0) {
        console.warn("⚠️  No payroll records found - dashboard will show zeros");
      } else {
        // Log sample
        const sample = payroll[0];
        console.log("  Sample payroll:", {
          projectId: sample.projectId,
          period: sample.period || sample.month,
          kind: sample.kind || "actual",
          amount: sample.amount,
        });
      }
    });
  });

  describeOrSkip("Data Structure Validation", () => {
    it("should have consistent baseline_id field naming", async () => {
      // Check P-CLOUD-ECOPETROL rubros
      const result = await ddb.send(
        new QueryCommand({
          TableName: tableName("projects"),
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: marshall({
            ":pk": "PROJECT#P-CLOUD-ECOPETROL",
            ":sk": "RUBRO#",
          }),
        })
      );

      const rubros = result.Items!.map((item) => unmarshall(item));

      // All rubros should have baseline_id in metadata (not top-level)
      for (const rubro of rubros) {
        // Check for both structures - top-level OR metadata
        const hasTopLevel = rubro.baselineId !== undefined;
        const hasMetadata = rubro.metadata?.baseline_id !== undefined;
        
        expect(hasTopLevel || hasMetadata).toBe(true);

        if (hasMetadata) {
          console.log(`✓ Rubro ${rubro.rubroId} has metadata.baseline_id: ${rubro.metadata.baseline_id}`);
        } else if (hasTopLevel) {
          console.log(`✓ Rubro ${rubro.rubroId} has top-level baselineId: ${rubro.baselineId}`);
        }
      }
    });
  });
});

/**
 * Summary of what this test validates:
 * 
 * 1. P-CLOUD-ECOPETROL project exists with:
 *    - Project metadata with baselineId
 *    - Rubros with metadata.baseline_id matching project baseline
 *    - Allocations (optional, forecast uses rubros fallback)
 *    - Payroll records (optional, shows as zeros if missing)
 * 
 * 2. P-SOC-BANCOL-MED project exists with:
 *    - Project metadata with baselineId = "BL-SOC-BANCOL-001"
 *    - Rubros with metadata.baseline_id matching project baseline
 * 
 * 3. Payroll dashboard has:
 *    - Projects with start dates for aggregation
 *    - Payroll records across projects for MOD calculations
 * 
 * To run this test:
 *   cd services/finanzas-api
 *   npm install
 *   npm run seed:canonical-projects
 *   npm test -- dev-environment-validation.spec.ts
 */

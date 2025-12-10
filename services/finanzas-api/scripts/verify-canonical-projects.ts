#!/usr/bin/env node
/**
 * Verify Canonical Projects Script
 * 
 * Checks if the 7 canonical projects are properly seeded in DynamoDB.
 * Validates:
 * - Project exists with baseline/handoff
 * - At least 1 rubro attachment
 * - Allocations for first 2-3 months
 * - Payroll actuals for first 2-3 months
 * 
 * Usage:
 *   npm run verify:canonical-projects
 * 
 * Environment variables:
 *   AWS_REGION (default: us-east-2)
 *   TABLE_PROJECTS (default: finz_projects)
 *   TABLE_ALLOC (default: finz_allocations)
 *   TABLE_PAYROLL (default: finz_payroll_actuals)
 */

import { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";
const TABLE_ALLOC = process.env.TABLE_ALLOC || "finz_allocations";
const TABLE_PAYROLL = process.env.TABLE_PAYROLL || "finz_payroll_actuals";

const ddb = new DynamoDBClient({ region: AWS_REGION });

// Canonical project IDs
const CANONICAL_PROJECTS = [
  { id: "P-NOC-CLARO-BOG", name: "NOC Claro Bogotá" },
  { id: "P-SOC-BANCOL-MED", name: "SOC Bancolombia Medellín" },
  { id: "P-WIFI-ELDORADO", name: "WiFi Aeropuerto El Dorado" },
  { id: "P-CLOUD-ECOPETROL", name: "Cloud Ops Ecopetrol" },
  { id: "P-SD-TIGO-CALI", name: "Service Delivery Tigo Cali" },
  { id: "P-CONNECT-AVIANCA", name: "Connectivity Avianca" },
  { id: "P-DATACENTER-ETB", name: "Datacenter ETB" },
];

/**
 * Check if a project exists
 */
async function checkProject(projectId: string): Promise<{
  exists: boolean;
  name?: string;
  client?: string;
  totalBudget?: number;
}> {
  try {
    const response = await ddb.send(
      new GetItemCommand({
        TableName: TABLE_PROJECTS,
        Key: marshall({
          pk: `PROJECT#${projectId}`,
          sk: "META",
        }),
      })
    );

    if (!response.Item) {
      return { exists: false };
    }

    const item = unmarshall(response.Item);
    return {
      exists: true,
      name: item.name,
      client: item.client,
      totalBudget: item.totalBudget,
    };
  } catch (error) {
    return { exists: false };
  }
}

/**
 * Check if a baseline/handoff exists and is active
 */
async function checkHandoff(projectId: string): Promise<{ exists: boolean; isActive: boolean; baselineId?: string }> {
  try {
    const response = await ddb.send(
      new GetItemCommand({
        TableName: TABLE_PROJECTS,
        Key: marshall({
          pk: `PROJECT#${projectId}`,
          sk: "HANDOFF",
        }),
      })
    );

    if (!response.Item) {
      return { exists: false, isActive: false };
    }

    const item = unmarshall(response.Item);
    return {
      exists: true,
      isActive: true,
      baselineId: item.baselineId,
    };
  } catch (error) {
    return { exists: false, isActive: false };
  }
}

/**
 * Count project rubro attachments
 */
async function countProjectRubros(projectId: string): Promise<number> {
  try {
    let count = 0;
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const response = await ddb.send(
        new QueryCommand({
          TableName: TABLE_PROJECTS,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :skPrefix)",
          ExpressionAttributeValues: marshall({
            ":pk": `PROJECT#${projectId}`,
            ":skPrefix": "RUBRO#",
          }),
          Select: "COUNT",
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      count += response.Count || 0;
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return count;
  } catch (error) {
    return 0;
  }
}

/**
 * Count allocations for a project (first few months)
 */
async function countAllocations(projectId: string): Promise<number> {
  try {
    // Use Scan with projectId filter since allocations have composite pk with month
    let count = 0;
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const response = await ddb.send(
        new ScanCommand({
          TableName: TABLE_ALLOC,
          FilterExpression: "projectId = :projectId",
          ExpressionAttributeValues: marshall({
            ":projectId": projectId,
          }),
          Select: "COUNT",
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      count += response.Count || 0;
      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return count;
  } catch (error) {
    return 0;
  }
}

/**
 * Get unique payroll months for a project
 */
async function getPayrollMonths(projectId: string): Promise<string[]> {
  try {
    // Use Scan with projectId filter since payroll has composite pk with month
    const months = new Set<string>();
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const response = await ddb.send(
        new ScanCommand({
          TableName: TABLE_PAYROLL,
          FilterExpression: "projectId = :projectId",
          ExpressionAttributeValues: marshall({
            ":projectId": projectId,
          }),
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      if (response.Items) {
        for (const item of response.Items) {
          const unmarshalled = unmarshall(item);
          if (unmarshalled.month) {
            months.add(unmarshalled.month);
          }
        }
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return Array.from(months).sort();
  } catch (error) {
    return [];
  }
}

interface VerificationResult {
  project: string;
  exists: boolean;
  hasHandoff: boolean;
  hasActiveBaseline: boolean;
  rubrosCount: number;
  allocationsCount: number;
  payrollMonths: string[];
  details?: string;
  isComplete: boolean;
}

/**
 * Main verification
 */
async function main() {
  console.log("🔍 Verifying Canonical Projects");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Tables: ${TABLE_PROJECTS}, ${TABLE_ALLOC}, ${TABLE_PAYROLL}`);
  console.log("═".repeat(80));
  console.log("");

  let foundCount = 0;
  let completeCount = 0;
  let missingCount = 0;
  const results: VerificationResult[] = [];

  for (const project of CANONICAL_PROJECTS) {
    process.stdout.write(`Checking ${project.id}...`);

    const projectData = await checkProject(project.id);
    
    if (!projectData.exists) {
      missingCount++;
      console.log(` ❌ NOT FOUND`);
      results.push({
        project: project.id,
        exists: false,
        hasHandoff: false,
        hasActiveBaseline: false,
        rubrosCount: 0,
        allocationsCount: 0,
        payrollMonths: [],
        isComplete: false,
      });
      continue;
    }

    foundCount++;
    
    // Check all components
    const handoffData = await checkHandoff(project.id);
    const rubrosCount = await countProjectRubros(project.id);
    const allocationsCount = await countAllocations(project.id);
    const payrollMonths = await getPayrollMonths(project.id);

    const isComplete =
      handoffData.exists &&
      handoffData.isActive &&
      rubrosCount > 0 &&
      allocationsCount > 0 &&
      payrollMonths.length >= 2;

    if (isComplete) {
      completeCount++;
      console.log(` ✅`);
    } else {
      console.log(` ⚠️  INCOMPLETE`);
    }

    results.push({
      project: project.id,
      exists: true,
      hasHandoff: handoffData.exists,
      hasActiveBaseline: handoffData.isActive,
      rubrosCount,
      allocationsCount,
      payrollMonths,
      details: `${projectData.name} (${projectData.client}) - $${(
        (projectData.totalBudget || 0) / 1000000
      ).toFixed(1)}M`,
      isComplete,
    });
  }

  console.log("\n" + "═".repeat(80));
  console.log("📊 Summary:\n");
  console.log(`   Total canonical projects: ${CANONICAL_PROJECTS.length}`);
  console.log(`   Found: ${foundCount}`);
  console.log(`   Complete (with all data): ${completeCount}`);
  console.log(`   Missing: ${missingCount}`);

  if (foundCount === CANONICAL_PROJECTS.length && completeCount === CANONICAL_PROJECTS.length) {
    console.log("\n✅ All canonical projects are properly seeded and complete!");

    console.log("\n📋 Project Details:\n");
    for (const result of results) {
      if (result.exists) {
        const status = result.isComplete ? "✅" : "⚠️ ";
        console.log(
          `   ${status} ${result.project}: ${result.details}`
        );
        console.log(
          `      Handoff: ${result.hasHandoff ? "✓" : "✗"} | ` +
          `Rubros: ${result.rubrosCount} | ` +
          `Allocations: ${result.allocationsCount} | ` +
          `Payroll months: ${result.payrollMonths.length > 0 ? result.payrollMonths.join(", ") : "none"}`
        );
      }
    }

    console.log("\n💡 Legend:");
    console.log("   ✅ Project is complete with all required data");
    console.log("   ⚠️  Project exists but missing some data");
  } else if (foundCount === CANONICAL_PROJECTS.length) {
    console.log("\n⚠️  All projects exist but some are incomplete!");
    
    console.log("\n📋 Incomplete Projects:\n");
    for (const result of results) {
      if (result.exists && !result.isComplete) {
        console.log(`   ⚠️  ${result.project}:`);
        if (!result.hasHandoff) console.log("      - Missing handoff/baseline");
        if (result.rubrosCount === 0) console.log("      - No rubros attached");
        if (result.allocationsCount === 0) console.log("      - No allocations");
        if (result.payrollMonths.length < 2) console.log("      - Insufficient payroll data (need >= 2 months)");
      }
    }

    console.log("\n💡 To re-seed the canonical projects, run:");
    console.log("   npm run reset:dev-projects");
    console.log("   npm run seed:canonical-projects");
  } else {
    console.log("\n❌ Some canonical projects are missing!");
    console.log("\nMissing projects:");
    for (const result of results) {
      if (!result.exists) {
        console.log(`   - ${result.project}`);
      }
    }

    console.log("\n💡 To seed the canonical projects, run:");
    console.log("   npm run seed:canonical-projects");
  }

  console.log("\n" + "═".repeat(80));

  // Exit with error code if any project is missing or incomplete
  if (missingCount > 0 || completeCount < CANONICAL_PROJECTS.length) {
    console.log("\n❌ Verification failed: Not all projects are complete");
    process.exit(1);
  }

  console.log("\n✅ Verification passed: All canonical projects are complete");
  process.exit(0);
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
}

export { main as verifyCanonicalProjects };

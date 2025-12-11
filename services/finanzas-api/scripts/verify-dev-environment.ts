#!/usr/bin/env ts-node
/**
 * Dev Environment Verification Script
 * 
 * This script verifies that the dev environment is properly configured for:
 * 1. Payroll Dashboard - /payroll/dashboard endpoint
 * 2. Forecast Grid - /plan/forecast endpoint for P-CLOUD-ECOPETROL
 * 3. Baseline Reject - /projects/{projectId}/reject-baseline for P-SOC-BANCOL-MED
 * 
 * Usage:
 *   AWS_REGION=us-east-2 TABLE_PREFIX=finz_ ts-node scripts/verify-dev-environment.ts
 */

import { DynamoDBClient, GetItemCommand, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PREFIX = process.env.TABLE_PREFIX || "finz_";

const ddb = new DynamoDBClient({ region: AWS_REGION });

const tableName = (name: string) => `${TABLE_PREFIX}${name}`;

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: any;
}

async function checkProjectExists(projectId: string, expectedBaselineId: string): Promise<ValidationResult> {
  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: tableName("projects"),
        Key: marshall({
          pk: `PROJECT#${projectId}`,
          sk: "METADATA",
        }),
      })
    );

    if (!result.Item) {
      return {
        passed: false,
        message: `Project ${projectId} not found in projects table`,
      };
    }

    const item = unmarshall(result.Item);

    if (item.baselineId !== expectedBaselineId) {
      return {
        passed: false,
        message: `Project ${projectId} has incorrect baseline_id`,
        details: {
          expected: expectedBaselineId,
          actual: item.baselineId,
        },
      };
    }

    return {
      passed: true,
      message: `Project ${projectId} exists with correct baseline_id`,
      details: {
        projectId: item.projectId,
        name: item.name,
        baselineId: item.baselineId,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function checkProjectRubros(projectId: string, expectedBaselineId: string): Promise<ValidationResult> {
  try {
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

    if (!result.Items || result.Items.length === 0) {
      return {
        passed: false,
        message: `No rubros found for project ${projectId}`,
      };
    }

    const rubros = result.Items.map((item) => unmarshall(item));

    // Check if rubros have baseline_id in metadata
    const rubrosWithBaseline = rubros.filter((rubro) => {
      const hasTopLevel = rubro.baselineId === expectedBaselineId;
      const hasMetadata = rubro.metadata?.baseline_id === expectedBaselineId;
      return hasTopLevel || hasMetadata;
    });

    if (rubrosWithBaseline.length === 0) {
      return {
        passed: false,
        message: `No rubros with baseline_id ${expectedBaselineId} found for project ${projectId}`,
        details: {
          totalRubros: rubros.length,
          rubrosWithBaseline: rubrosWithBaseline.length,
        },
      };
    }

    return {
      passed: true,
      message: `Found ${rubrosWithBaseline.length} rubros with correct baseline_id for project ${projectId}`,
      details: {
        totalRubros: rubros.length,
        rubrosWithBaseline: rubrosWithBaseline.length,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking rubros for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function checkPayrollData(projectId: string): Promise<ValidationResult> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("payroll_actuals"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({
          ":pk": `PROJECT#${projectId}`,
        }),
      })
    );

    const payroll = result.Items ? result.Items.map((item) => unmarshall(item)) : [];

    return {
      passed: true,
      message: `Found ${payroll.length} payroll records for project ${projectId}`,
      details: {
        count: payroll.length,
        note: payroll.length === 0 ? "Forecast will show zeros for actuals" : undefined,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking payroll for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function checkAllocationsData(projectId: string): Promise<ValidationResult> {
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: tableName("allocations"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: marshall({
          ":pk": `PROJECT#${projectId}`,
        }),
      })
    );

    const allocations = result.Items ? result.Items.map((item) => unmarshall(item)) : [];

    return {
      passed: true,
      message: `Found ${allocations.length} allocations for project ${projectId}`,
      details: {
        count: allocations.length,
        note: allocations.length === 0 ? "Forecast will use rubros fallback" : undefined,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking allocations for project ${projectId}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function checkPayrollDashboardData(): Promise<ValidationResult> {
  try {
    // Check for projects with start dates
    const projectsResult = await ddb.send(
      new ScanCommand({
        TableName: tableName("projects"),
        FilterExpression: "begins_with(pk, :pk) AND sk = :sk",
        ExpressionAttributeValues: marshall({
          ":pk": "PROJECT#",
          ":sk": "METADATA",
        }),
      })
    );

    const projects = projectsResult.Items ? projectsResult.Items.map((item) => unmarshall(item)) : [];
    const projectsWithDates = projects.filter((p) => 
      p.startMonth || p.start_date || p.fecha_inicio
    );

    // Check for payroll records
    const payrollResult = await ddb.send(
      new ScanCommand({
        TableName: tableName("payroll_actuals"),
        FilterExpression: "begins_with(pk, :pk) AND begins_with(sk, :sk)",
        ExpressionAttributeValues: marshall({
          ":pk": "PROJECT#",
          ":sk": "PAYROLL#",
        }),
      })
    );

    const payroll = payrollResult.Items ? payrollResult.Items.map((item) => unmarshall(item)) : [];

    const passed = projects.length > 0 && projectsWithDates.length > 0;

    return {
      passed,
      message: passed
        ? `Payroll dashboard data looks good`
        : `Missing data for payroll dashboard`,
      details: {
        totalProjects: projects.length,
        projectsWithStartDates: projectsWithDates.length,
        totalPayrollRecords: payroll.length,
      },
    };
  } catch (error) {
    return {
      passed: false,
      message: `Error checking payroll dashboard data: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main() {
  console.log("🔍 Verifying Dev Environment Configuration");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Table Prefix: ${TABLE_PREFIX}`);
  console.log("═".repeat(80));
  console.log("");

  const results: { name: string; result: ValidationResult }[] = [];

  // Test 1: P-CLOUD-ECOPETROL Project
  console.log("📦 Checking P-CLOUD-ECOPETROL project...");
  results.push({
    name: "P-CLOUD-ECOPETROL: Project Metadata",
    result: await checkProjectExists("P-CLOUD-ECOPETROL", "BL-CLOUD-ECOPETROL-001"),
  });
  results.push({
    name: "P-CLOUD-ECOPETROL: Rubros",
    result: await checkProjectRubros("P-CLOUD-ECOPETROL", "BL-CLOUD-ECOPETROL-001"),
  });
  results.push({
    name: "P-CLOUD-ECOPETROL: Allocations",
    result: await checkAllocationsData("P-CLOUD-ECOPETROL"),
  });
  results.push({
    name: "P-CLOUD-ECOPETROL: Payroll",
    result: await checkPayrollData("P-CLOUD-ECOPETROL"),
  });
  console.log("");

  // Test 2: P-SOC-BANCOL-MED Project
  console.log("📦 Checking P-SOC-BANCOL-MED project...");
  results.push({
    name: "P-SOC-BANCOL-MED: Project Metadata",
    result: await checkProjectExists("P-SOC-BANCOL-MED", "BL-SOC-BANCOL-001"),
  });
  results.push({
    name: "P-SOC-BANCOL-MED: Rubros",
    result: await checkProjectRubros("P-SOC-BANCOL-MED", "BL-SOC-BANCOL-001"),
  });
  console.log("");

  // Test 3: Payroll Dashboard
  console.log("📊 Checking payroll dashboard data...");
  results.push({
    name: "Payroll Dashboard: Projects and Payroll Data",
    result: await checkPayrollDashboardData(),
  });
  console.log("");

  // Print results
  console.log("═".repeat(80));
  console.log("📋 Validation Results");
  console.log("═".repeat(80));
  console.log("");

  let allPassed = true;
  for (const { name, result } of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${name}`);
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log("");

    if (!result.passed) {
      allPassed = false;
    }
  }

  console.log("═".repeat(80));
  if (allPassed) {
    console.log("✅ All validations passed!");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Verify API Gateway routes are deployed in AWS");
    console.log("  2. Test frontend calls to /payroll/dashboard");
    console.log("  3. Test forecast endpoint with P-CLOUD-ECOPETROL");
    console.log("  4. Test baseline reject with P-SOC-BANCOL-MED");
  } else {
    console.log("❌ Some validations failed!");
    console.log("");
    console.log("To fix:");
    console.log("  1. Run: npm run seed:canonical-projects");
    console.log("  2. Re-run this verification script");
  }
  console.log("═".repeat(80));

  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };

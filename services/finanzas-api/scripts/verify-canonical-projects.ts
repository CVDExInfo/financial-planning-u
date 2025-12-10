#!/usr/bin/env node
/**
 * Verify Canonical Projects Script
 * 
 * Checks if the 7 canonical projects are properly seeded in DynamoDB.
 * 
 * Usage:
 *   npm run verify:canonical-projects
 * 
 * Environment variables:
 *   AWS_REGION (default: us-east-2)
 *   TABLE_PROJECTS (default: finz_projects)
 */

import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE_PROJECTS = process.env.TABLE_PROJECTS || "finz_projects";

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
 * Check if a baseline/handoff exists
 */
async function checkHandoff(projectId: string): Promise<boolean> {
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

    return !!response.Item;
  } catch (error) {
    return false;
  }
}

/**
 * Main verification
 */
async function main() {
  console.log("🔍 Verifying Canonical Projects");
  console.log("═".repeat(80));
  console.log(`   Region: ${AWS_REGION}`);
  console.log(`   Table: ${TABLE_PROJECTS}`);
  console.log("═".repeat(80));
  console.log("");

  let foundCount = 0;
  let missingCount = 0;
  const results: {
    project: string;
    exists: boolean;
    hasHandoff: boolean;
    details?: string;
  }[] = [];

  for (const project of CANONICAL_PROJECTS) {
    process.stdout.write(`Checking ${project.id}...`);

    const projectData = await checkProject(project.id);
    const hasHandoff = projectData.exists ? await checkHandoff(project.id) : false;

    if (projectData.exists) {
      foundCount++;
      console.log(` ✅`);
      results.push({
        project: project.id,
        exists: true,
        hasHandoff,
        details: `${projectData.name} (${projectData.client}) - $${(
          (projectData.totalBudget || 0) / 1000000
        ).toFixed(1)}M`,
      });
    } else {
      missingCount++;
      console.log(` ❌ NOT FOUND`);
      results.push({
        project: project.id,
        exists: false,
        hasHandoff: false,
      });
    }
  }

  console.log("\n" + "═".repeat(80));
  console.log("📊 Summary:\n");
  console.log(`   Total canonical projects: ${CANONICAL_PROJECTS.length}`);
  console.log(`   Found: ${foundCount}`);
  console.log(`   Missing: ${missingCount}`);

  if (foundCount === CANONICAL_PROJECTS.length) {
    console.log("\n✅ All canonical projects are properly seeded!");

    console.log("\n📋 Project Details:\n");
    for (const result of results) {
      if (result.exists) {
        const handoffStatus = result.hasHandoff ? "✓" : "✗";
        console.log(`   [${handoffStatus}] ${result.project}: ${result.details}`);
      }
    }

    console.log("\n💡 Legend:");
    console.log("   [✓] Project has handoff/baseline");
    console.log("   [✗] Project missing handoff/baseline");
  } else {
    console.log("\n⚠️  Some canonical projects are missing!");
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

  // Exit with error code if projects are missing
  if (missingCount > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
}

export { main as verifyCanonicalProjects };

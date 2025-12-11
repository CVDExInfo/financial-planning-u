/**
 * Seed project rubros (line items) for demo projects
 * Populates 3-4 rubros per project so the UI grid is non-empty
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const region = process.env.AWS_REGION || "us-east-2";
const tableName = process.env.RUBROS_TABLE || "Finanzas-Rubros-dev";

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

// Demo projects to seed
const DEMO_PROJECTS = ["P-c1d76e28", "P-5ae50ace", "P-75596c6c", "P-546370be"];

// Sample rubros to add to each project
// UPDATED: Using canonical taxonomy IDs (linea_codigo format)
const SAMPLE_RUBROS = [
  {
    rubro_id: "MOD-LEAD", // Canonical ID (was: RUBRO-SENIOR-DEV)
    description: "Ingeniero líder / coordinador",
    category: "MOD",
    qty: 2,
    unit_cost: 12500,
    duration: "M1-12",
    type: "Recurring",
  },
  {
    rubro_id: "INF-CLOUD", // Canonical ID (was: RUBRO-AWS-INFRA)
    description: "Servicios Cloud / hosting",
    category: "INF",
    qty: 1,
    unit_cost: 3500,
    duration: "M1-12",
    type: "Recurring",
  },
  {
    rubro_id: "TEC-LIC-MON", // Canonical ID (was: RUBRO-LICENSE)
    description: "Licencias de monitoreo/observabilidad",
    category: "TEC",
    qty: 5,
    unit_cost: 299,
    duration: "M1-12",
    type: "Recurring",
  },
  {
    rubro_id: "GSV-REU", // Canonical ID (was: RUBRO-CONSULTING)
    description: "Reuniones de seguimiento",
    category: "GSV",
    qty: 40,
    unit_cost: 175,
    duration: "M1-3",
    type: "Non-Recurring",
  },
];

async function seedProjectRubros() {
  console.log(`Seeding rubros for ${DEMO_PROJECTS.length} demo projects...`);
  console.log(`Table: ${tableName}`);

  let totalInserted = 0;

  for (const projectId of DEMO_PROJECTS) {
    console.log(`\nSeeding rubros for project: ${projectId}`);

    for (const rubro of SAMPLE_RUBROS) {
      const item = {
        PK: `PROJECT#${projectId}`,
        SK: `RUBRO#${rubro.rubro_id}`,
        project_id: projectId,
        rubro_id: rubro.rubro_id,
        description: rubro.description,
        category: rubro.category,
        qty: rubro.qty,
        unit_cost: rubro.unit_cost,
        total_cost: rubro.qty * rubro.unit_cost,
        duration: rubro.duration,
        type: rubro.type,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      try {
        await docClient.send(
          new PutCommand({
            TableName: tableName,
            Item: item,
          })
        );
        console.log(`  ✅ Added: ${rubro.description}`);
        totalInserted++;
      } catch (error) {
        console.error(`  ❌ Failed to add ${rubro.description}:`, error);
      }
    }
  }

  console.log(`\n✅ Seeding complete! Inserted ${totalInserted} rubros.`);
}

// Run if executed directly
if (require.main === module) {
  seedProjectRubros()
    .then(() => {
      console.log("Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seed failed:", error);
      process.exit(1);
    });
}

export { seedProjectRubros };

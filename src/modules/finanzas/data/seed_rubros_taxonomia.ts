#!/usr/bin/env node
/**
 * Seeder para la tabla DynamoDB de taxonomía de rubros.
 * Env:
 *   TABLE_RUBROS_TAXONOMIA
 *   AWS_REGION
 */
import { RUBROS_TAXONOMIA } from "./rubros.taxonomia";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

async function run() {
  const tableName = process.env.TABLE_RUBROS_TAXONOMIA;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!tableName) {
    console.error("❌ TABLE_RUBROS_TAXONOMIA no definido");
    process.exit(1);
  }
  const client = new DynamoDBClient({ region });
  let inserted = 0;
  for (const t of RUBROS_TAXONOMIA) {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          rubro_id: { S: t.rubro_id },
          categoria: { S: t.categoria },
          linea_codigo: { S: t.linea_codigo },
          tipo_costo: { S: t.tipo_costo },
        },
      })
    );
    inserted++;
  }
  console.log(
    `✅ Seed taxonomía completado. ${inserted} items insertados en ${tableName}`
  );
}

run().catch((err) => {
  console.error("❌ Error en seed taxonomía", err);
  process.exit(1);
});

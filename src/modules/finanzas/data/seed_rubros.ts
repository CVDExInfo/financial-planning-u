#!/usr/bin/env node
/**
 * Seeder para la tabla DynamoDB de rubros (catálogo base).
 * Usa variables de entorno:
 *   TABLE_RUBROS (nombre de la tabla)
 *   AWS_REGION (región AWS)
 * Requiere credenciales vía OIDC en CI/CD o perfil local.
 */
import { RUBROS_CATALOG } from "./rubros.catalog";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

async function run() {
  const tableName = process.env.TABLE_RUBROS;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!tableName) {
    console.error("❌ TABLE_RUBROS no definido");
    process.exit(1);
  }
  const client = new DynamoDBClient({ region });
  let inserted = 0;
  for (const item of RUBROS_CATALOG) {
    await client.send(
      new PutItemCommand({
        TableName: tableName,
        Item: {
          rubro_id: { S: item.rubro_id },
          nombre: { S: item.nombre },
          descripcion: { S: item.descripcion || "" },
        },
      })
    );
    inserted++;
  }
  console.log(
    `✅ Seed rubros completado. ${inserted} items insertados en ${tableName}`
  );
}

run().catch((err) => {
  console.error("❌ Error en seed rubros", err);
  process.exit(1);
});

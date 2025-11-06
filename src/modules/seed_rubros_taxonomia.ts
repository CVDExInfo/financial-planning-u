// Seed script for DynamoDB: rubros_taxonomia table
// Usage (CI or local with creds):
//   TS_NODE_TRANSPILE_ONLY=1 ts-node seed_rubros_taxonomia.ts
// Required env:
//   AWS_REGION=us-east-2
//   TABLE_RUBROS_TAXONOMIA=rubros_taxonomia
//
// The script is idempotent (PutItem by linea_codigo).

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { CATALOGO_RUBROS } from "./rubros.taxonomia";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE = process.env.TABLE_RUBROS_TAXONOMIA || "rubros_taxonomia";

if (!TABLE) {
  console.error("Missing TABLE_RUBROS_TAXONOMIA");
  process.exit(1);
}

const ddb = new DynamoDBClient({ region: AWS_REGION });

async function main() {
  for (const row of CATALOGO_RUBROS) {
    // Composite keys for taxonomy table similar pattern:
    // pk = LINEA#<linea_codigo>, sk = CATEGORIA#<categoria_codigo>
    const item = {
      pk: `LINEA#${row.linea_codigo}`,
      sk: `CATEGORIA#${row.categoria_codigo}`,
      linea_codigo: row.linea_codigo,
      categoria_codigo: row.categoria_codigo,
      categoria: row.categoria,
      linea_gasto: row.linea_gasto,
      descripcion: row.descripcion,
      tipo_ejecucion: row.tipo_ejecucion,
      tipo_costo: row.tipo_costo,
      fuente_referencia: row.fuente_referencia,
      // Suggested GSI (not yet provisioned): GSI1PK = categoria_codigo, GSI1SK = linea_codigo
    };
    const cmd = new PutItemCommand({
      TableName: TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    });
    await ddb.send(cmd);
    console.log(`Upserted taxonomía: ${row.linea_codigo}`);
  }
  console.log("✅ Taxonomía seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Seed script for DynamoDB: finz_rubros_taxonomia (composite pk/sk)
// Usage:
//   TS_NODE_TRANSPILE_ONLY=1 ts-node scripts/ts-seeds/seed_rubros_taxonomia.ts
// Env required:
//   AWS_REGION=us-east-2
//   TABLE_RUBROS_TAXONOMIA=finz_rubros_taxonomia

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { CATALOGO_RUBROS } from "../../src/modules/rubros.taxonomia";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE = process.env.TABLE_RUBROS_TAXONOMIA || "finz_rubros_taxonomia";

if (!TABLE) {
  console.error("Missing TABLE_RUBROS_TAXONOMIA");
  process.exit(1);
}

const ddb = new DynamoDBClient({ region: AWS_REGION });

async function main() {
  for (const row of CATALOGO_RUBROS) {
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

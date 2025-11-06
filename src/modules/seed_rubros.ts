// Seed script for DynamoDB: rubros table (items)
// @ts-nocheck
// Usage (CI or local with creds):
//   TS_NODE_TRANSPILE_ONLY=1 ts-node seed_rubros.ts
// Required env:
//   AWS_REGION=us-east-2
//   TABLE_RUBROS=rubros
//
// The script is idempotent (PutItem by rubro_id).

import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { RUBROS } from "./rubros.catalog";
import { enrichRubro } from "./rubros.catalog.enriched";

const AWS_REGION = process.env.AWS_REGION || "us-east-2";
const TABLE = process.env.TABLE_RUBROS || "rubros";

if (!TABLE) {
  console.error("Missing TABLE_RUBROS");
  process.exit(1);
}

const ddb = new DynamoDBClient({ region: AWS_REGION });

async function main() {
  for (const base of RUBROS) {
    const r = enrichRubro(base);
    // Persist using composite keys expected by finz_rubros (pk/sk)
    // Convention: pk = RUBRO#<id>, sk = DEF (single version)
    const item = {
      pk: `RUBRO#${r.rubro_id}`,
      sk: `DEF`,
      rubro_id: r.rubro_id,
      nombre: r.nombre,
      centro: r.centro ?? null,
      regla: r.regla ?? null,
      metadata: r.metadata ?? null,
      // Link to taxonomy if available
      linea_codigo: r.linea_codigo ?? null,
      categoria_codigo: r.categoria_codigo ?? null,
      categoria: r.categoria ?? null,
      linea_gasto: r.linea_gasto ?? null,
      tipo_ejecucion: r.tipo_ejecucion ?? null,
      tipo_costo: r.tipo_costo ?? null,
      fuente_referencia: r.fuente_referencia ?? null,
    };

    const cmd = new PutItemCommand({
      TableName: TABLE,
      Item: marshall(item, { removeUndefinedValues: true }),
    });
    await ddb.send(cmd);
    console.log(`Upserted rubro: ${r.rubro_id}`);
  }
  console.log("✅ Rubros seed complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

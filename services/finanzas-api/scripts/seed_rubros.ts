/*
  Seed script for rubros table.
  Reads /mnt/data/catalogo_rubros_ikusi.xlsx and upserts rows into DynamoDB table specified by env TABLE_RUBROS.
*/
import AWS from "aws-sdk";
import * as XLSX from "xlsx";

const ddb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || "us-east-2",
});
const TABLE =
  process.env.TABLE_RUBROS ||
  process.env.npm_package_config_TABLE_RUBROS ||
  "finz_rubros";

function readWorkbook(path: string) {
  const wb = XLSX.readFile(path);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
}

function mapRow(row: Record<string, unknown>) {
  // Map expected columns → { rubro_id, nombre, centro, regla, metadata }
  // Accept various header variants
  const r = row as Record<string, unknown>;
  const rubro_id = String(
    (r.rubro_id ?? r.id ?? r.ID ?? r.RUBRO_ID ?? "") as string
  ).trim();
  const nombre = String(
    (r.nombre ?? r.Nombre ?? r.NOMBRE ?? "") as string
  ).trim();
  const centro = String(
    (r.centro ?? r.Centro ?? r.CENTRO ?? "") as string
  ).trim();
  const regla = String((r.regla ?? r.Regla ?? r.REGLA ?? "") as string).trim();
  const metadata = (r.metadata as Record<string, unknown>) || {};
  if (!rubro_id || !nombre) return null;
  return { rubro_id, nombre, centro, regla, metadata };
}

async function upsert(item: {
  rubro_id: string;
  nombre: string;
  centro?: string;
  regla?: string;
  metadata?: Record<string, unknown>;
}) {
  const pk = `RUBRO#${item.rubro_id}`;
  const sk = `DEF#${item.rubro_id}`;
  await ddb
    .put({
      TableName: TABLE,
      Item: {
        pk,
        sk,
        rubro_id: item.rubro_id,
        nombre: item.nombre,
        centro: item.centro || null,
        regla: item.regla || null,
        metadata: item.metadata || {},
        updated_at: new Date().toISOString(),
      },
    })
    .promise();
}

async function main() {
  const path = "/mnt/data/catalogo_rubros_ikusi.xlsx";
  console.log(`Reading ${path} ...`);
  const rows = readWorkbook(path);
  console.log(`Rows: ${rows.length}`);
  let ok = 0;
  for (const r of rows) {
    const m = mapRow(r);
    if (!m) continue;
    await upsert(m);
    ok++;
  }
  console.log(`Seed complete. Upserted: ${ok}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

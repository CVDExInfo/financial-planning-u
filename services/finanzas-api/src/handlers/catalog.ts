import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ddb, tableName } from "../lib/dynamo";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { cors } from "../lib/http";

type RubroItem = {
  rubro_id?: string;
  nombre?: string;
  categoria?: string | null;
  linea_codigo?: string | null;
  tipo_costo?: string | null;
  tipo_ejecucion?: string | null;
  descripcion?: string | null;
};

type RubroTaxonomia = {
  linea_codigo?: string | null;
  categoria?: string | null;
  tipo_costo?: string | null;
  tipo_ejecucion?: string | null;
  descripcion?: string | null;
  linea_gasto?: string | null;
};

function encodeNextToken(key: Record<string, unknown> | undefined) {
  if (!key) return undefined;
  return Buffer.from(JSON.stringify(key)).toString("base64");
}
function decodeNextToken(token: string | undefined) {
  if (!token) return undefined;
  try {
    return JSON.parse(Buffer.from(token, "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return undefined;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Minimal enriched fallback to avoid 500 while DDB/Tables are not ready
  const FALLBACK: RubroItem[] = [
    {
      rubro_id: "R-OPS-N1",
      nombre: "Operación / Infra",
      categoria: "OPEX",
      linea_codigo: "OPS",
      tipo_costo: "RECURRENT",
      tipo_ejecucion: "INTERNAL",
      descripcion: "Gastos operativos base",
    },
  ];

  try {
    // Query params: limit (1-200), nextToken (opaque)
    const qp = event.queryStringParameters || {};
    const limit = Math.min(
      Math.max(parseInt(qp.limit || "100", 10) || 100, 1),
      200
    );
    const startKey = decodeNextToken(qp.nextToken);

    // For R1 we do a simple Scan over the rubros table (seeded). Future: add GSI and Query by linea/categoria.
    const params = {
      TableName: tableName("rubros"),
      Limit: limit,
      ExclusiveStartKey: startKey,
      ProjectionExpression:
        "rubro_id, nombre, categoria, linea_codigo, tipo_costo, tipo_ejecucion, descripcion",
      FilterExpression: "attribute_not_exists(sk) OR sk = :def OR sk = :metadata",
      ExpressionAttributeValues: { ":def": "DEF", ":metadata": "METADATA" },
    } as const;

    const [out, taxonomyScan] = await Promise.all([
      ddb.send(new ScanCommand(params)),
      ddb.send(
        new ScanCommand({
          TableName: tableName("rubros_taxonomia"),
          ProjectionExpression:
            "linea_codigo, categoria, tipo_costo, tipo_ejecucion, descripcion, linea_gasto",
        }),
      ),
    ]);

    const taxonomyEntries = (taxonomyScan.Items || []) as RubroTaxonomia[];
    const taxonomyByLinea = new Map<string, RubroTaxonomia>();
    const taxonomyByRubro = new Map<string, RubroTaxonomia>();

    taxonomyEntries.forEach((tx) => {
      if (tx.linea_codigo) taxonomyByLinea.set(tx.linea_codigo, tx);
      if (tx.linea_gasto) taxonomyByRubro.set(tx.linea_gasto, tx);
    });

    const items = (out.Items || []) as RubroItem[];
    let data = items
      .filter((it) => !!it.rubro_id && !!it.nombre)
      .map((it) => {
        const taxonomy =
          taxonomyByLinea.get(it.linea_codigo || "") ||
          taxonomyByRubro.get(it.rubro_id || "") ||
          undefined;
        return {
          rubro_id: it.rubro_id!,
          nombre: it.nombre!,
          categoria: it.categoria ?? taxonomy?.categoria ?? undefined,
          linea_codigo: it.linea_codigo ?? taxonomy?.linea_codigo ?? undefined,
          tipo_costo: it.tipo_costo ?? taxonomy?.tipo_costo ?? undefined,
          tipo_ejecucion: it.tipo_ejecucion ?? taxonomy?.tipo_ejecucion ?? undefined,
          descripcion: it.descripcion ?? taxonomy?.descripcion ?? undefined,
        };
      });

    if (data.length === 0 && taxonomyEntries.length > 0) {
      data = taxonomyEntries
        .filter((tx) => tx.linea_codigo && tx.linea_gasto)
        .map((tx) => ({
          rubro_id: tx.linea_codigo as string,
          nombre: tx.linea_gasto as string,
          categoria: tx.categoria ?? undefined,
          linea_codigo: tx.linea_codigo ?? undefined,
          tipo_costo: tx.tipo_costo ?? undefined,
          tipo_ejecucion: tx.tipo_ejecucion ?? undefined,
          descripcion: tx.descripcion ?? undefined,
        }));
    }

    const nextToken = encodeNextToken(
      out.LastEvaluatedKey as unknown as Record<string, unknown> | undefined,
    );

    return {
      statusCode: 200,
      headers: { ...cors, "Content-Type": "application/json" },
      // Keep envelope compatible; include optional pagination fields for future use
      body: JSON.stringify({ data, total: data.length, nextToken }),
    };
  } catch (err) {
    console.warn("/catalog/rubros fallback due to error:", err);
    return {
      statusCode: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "X-Fallback": "true",
      },
      body: JSON.stringify({ data: FALLBACK, total: FALLBACK.length }),
    };
  }
};

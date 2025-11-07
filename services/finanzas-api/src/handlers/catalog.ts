import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ddb, tableName } from "../lib/dynamo";

type RubroItem = {
  rubro_id?: string;
  nombre?: string;
  categoria?: string | null;
  linea_codigo?: string | null;
  tipo_costo?: string | null;
  tipo_ejecucion?: string | null;
  descripcion?: string | null;
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
      // Narrow the projection to relevant attributes for bandwidth efficiency
      ProjectionExpression:
        "rubro_id, nombre, categoria, linea_codigo, tipo_costo, tipo_ejecucion, descripcion",
      // Filter only definition rows. In this table, some items may have an 'sk' attribute to distinguish between different item types
      // (e.g., versioning, metadata, or other variants). Rows with 'sk' = 'DEF' represent the main definition entries for a rubro,
      // while other 'sk' values (or absence of 'sk') may represent other item types or legacy rows. This filter ensures we only
      // return definition rows. Note: safe if attribute sk exists; if not, Dynamo will ignore it in filter.
      FilterExpression: "attribute_not_exists(sk) OR sk = :def",
      ExpressionAttributeValues: { ":def": "DEF" },
    } as const;

    const out = await ddb.scan(params).promise();
    const items = (out.Items || []) as RubroItem[];
    const data = items
      .filter((it) => !!it.rubro_id && !!it.nombre)
      .map((it) => ({
        rubro_id: it.rubro_id!,
        nombre: it.nombre!,
        categoria: it.categoria ?? undefined,
        linea_codigo: it.linea_codigo ?? undefined,
        tipo_costo: it.tipo_costo ?? undefined,
        tipo_ejecucion: it.tipo_ejecucion ?? undefined,
        descripcion: it.descripcion ?? undefined,
      }));

    const nextToken = encodeNextToken(
      out.LastEvaluatedKey as unknown as Record<string, unknown> | undefined
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      // Keep envelope compatible; include optional pagination fields for future use
      body: JSON.stringify({ data, total: data.length, nextToken }),
    };
  } catch (err) {
    console.error("/catalog/rubros failed:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal error", detail: `${err}` }),
    };
  }
};

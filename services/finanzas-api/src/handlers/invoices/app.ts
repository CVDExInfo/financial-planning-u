import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

const json = (
  statusCode: number,
  body: Record<string, unknown>,
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN ?? "*",
    "Access-Control-Allow-Credentials": "true",
  },
  body: JSON.stringify(body),
});

const notFound = (message: string) => json(404, { error: message });
const badRequest = (message: string) => json(400, { error: message });
const ok = (data: Record<string, unknown> | unknown[]) =>
  json(200, Array.isArray(data) ? { data } : data);
const serverError = (message: string) =>
  json(500, { error: "Failed to process invoice request", message });

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext?.http?.method ?? "";
    const rawPath = event.rawPath ?? "";
    const projectId = event.pathParameters?.projectId;
    const invoiceId = event.pathParameters?.invoiceId;

    if (!projectId) {
      return badRequest("Missing projectId");
    }

    const isInvoicesCollection =
      rawPath.endsWith("/invoices") && method === "GET";
    if (isInvoicesCollection) {
      return ok({ data: [], projectId });
    }

    const isInvoiceLookup =
      rawPath.includes("/invoices/") &&
      !rawPath.endsWith("/status") &&
      method === "GET";

    if (isInvoiceLookup) {
      if (!invoiceId) {
        return badRequest("Missing invoiceId");
      }
      return notFound("Invoice not found");
    }

    const isStatusUpdate = rawPath.endsWith("/status") && method === "PUT";
    if (isStatusUpdate) {
      if (!invoiceId) {
        return badRequest("Missing invoiceId");
      }
      return ok({ ok: true, projectId, invoiceId });
    }

    return notFound("Route not handled by InvoicesFn");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("InvoicesFn error", error);
    return serverError(message);
  }
}

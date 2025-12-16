import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanWrite } from "../lib/auth";
import { bad, notImplemented } from "../lib/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    await ensureCanWrite(event as any);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unauthorized";
    return bad(event as any, message, 403);
  }

  return notImplemented(
    event as any,
    "Payroll upload endpoint is not yet implemented."
  );
};

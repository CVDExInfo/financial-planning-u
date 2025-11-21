import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureSDT } from "../lib/auth";
import { bad, ok } from "../lib/http";

// TODO: Implement payroll data ingestion
// R1 requirement: POST /payroll/ingest
export const handler = async (event: APIGatewayProxyEventV2) => {
  ensureSDT(event);

  const method = event.requestContext.http.method;

  if (method === "GET") {
    // Placeholder for payroll actuals listing
    return ok({ message: "GET /payroll/actuals - not implemented yet" }, 501);
  }

  if (method === "POST") {
    // TODO: Parse payroll file (CSV/Excel) and insert into payroll_actuals table
    return ok(
      { message: "POST /payroll/ingest - not implemented yet" },
      501
    );
  }

  return bad(`Method ${method} not allowed`, 405);
};

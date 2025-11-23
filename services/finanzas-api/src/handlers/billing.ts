import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ensureCanRead } from "../lib/auth";
import { ok, bad, serverError, fromAuthError } from "../lib/http";
import { ddb, tableName, QueryCommand } from "../lib/dynamo";

interface BillingPeriod {
  month: number;
  amount: number;
  currency: string;
  status: "planned" | "invoiced" | "collected";
}

const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 36;

function parseMonths(value?: string | null) {
  if (!value) return DEFAULT_MONTHS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_MONTHS;
  return Math.min(Math.max(parsed, 1), MAX_MONTHS);
}

function normalizeMonth(value: unknown): number | null {
  const month = Number(value);
  if (!Number.isFinite(month)) return null;
  if (month < 1 || month > 60) return null;
  return Math.trunc(month);
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    await ensureCanRead(event as never);
  } catch (error) {
    const authError = fromAuthError(error);
    if (authError) {
      return authError;
    }
    throw error;
  }

  const projectId =
    event.pathParameters?.projectId ||
    event.pathParameters?.id ||
    event.queryStringParameters?.project_id;

  if (!projectId) {
    return bad("missing project id");
  }

  const months = parseMonths(event.queryStringParameters?.months);

  try {
    const invoices = await ddb.send(
      new QueryCommand({
        TableName: tableName("prefacturas"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `PROJECT#${projectId}`,
        },
      })
    );

    const items = invoices.Items || [];
    const inflows = new Map<
      number,
      { amount: number; currency?: string; status: BillingPeriod["status"] }
    >();

    let fallbackCurrency = "USD";

    for (const invoice of items) {
      const month = normalizeMonth((invoice as Record<string, unknown>).month);
      if (!month) continue;

      const amount = Number((invoice as Record<string, unknown>).amount) || 0;
      const currency =
        (invoice as Record<string, unknown>).currency?.toString() ||
        fallbackCurrency;
      const statusRaw = (invoice as Record<string, unknown>).status;
      const status =
        statusRaw === "collected"
          ? "collected"
          : amount > 0
          ? "invoiced"
          : "planned";

      fallbackCurrency = currency || fallbackCurrency;
      const existing = inflows.get(month) || {
        amount: 0,
        currency,
        status: "planned" as BillingPeriod["status"],
      };

      inflows.set(month, {
        amount: existing.amount + amount,
        currency: existing.currency || currency || fallbackCurrency,
        status:
          status === "collected" || existing.status === "collected"
            ? "collected"
            : status === "invoiced" || existing.status === "invoiced"
            ? "invoiced"
            : "planned",
      });
    }

    const monthly_inflows: BillingPeriod[] = Array.from(
      { length: months },
      (_, idx) => {
        const month = idx + 1;
        const bucket = inflows.get(month);
        return {
          month,
          amount: Number((bucket?.amount || 0).toFixed(2)),
          currency: bucket?.currency || fallbackCurrency,
          status: bucket?.status || "planned",
        };
      }
    );

    return ok({
      project_id: projectId,
      generated_at: new Date().toISOString(),
      monthly_inflows,
    });
  } catch (error) {
    console.error("Error generating billing plan:", error);
    return serverError(
      error instanceof Error ? error.message : "Failed to load billing plan"
    );
  }
};

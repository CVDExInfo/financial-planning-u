import type { ForecastCell, InvoiceDoc, LineItem } from "@/types/domain";
import { safeFetch } from "./client";

type ApiArray<T> = T | { data: T; total?: number };

const unwrap = <T>(payload: ApiArray<T>): T => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (typeof payload === "object" && payload && "data" in payload) {
    return payload.data;
  }
  return payload;
};

export async function getForecast(projectId: string, months: number) {
  const params = new URLSearchParams({
    projectId,
    months: String(months),
  });

  return safeFetch<ForecastCell[]>(`/plan/forecast?${params.toString()}`);
}

export async function getInvoices(projectId: string) {
  const params = new URLSearchParams({ projectId });
  const response = await safeFetch<ApiArray<InvoiceDoc[]>>(
    `/prefacturas?${params.toString()}`
  );
  return unwrap(response);
}

export async function getProjectRubros(projectId: string) {
  const response = await safeFetch<ApiArray<LineItem[]>>(
    `/projects/${encodeURIComponent(projectId)}/rubros`
  );
  return unwrap(response);
}

export type AddProjectRubroPayload = {
  rubroId: string;
  qty: number;
  unitCost: number;
  type: string;
  duration: string;
};

export function addProjectRubro(
  projectId: string,
  payload: AddProjectRubroPayload
) {
  return safeFetch<LineItem>(
    `/projects/${encodeURIComponent(projectId)}/rubros`,
    {
      method: "POST",
      body: payload,
    }
  );
}

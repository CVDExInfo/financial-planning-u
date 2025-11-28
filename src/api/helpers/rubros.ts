export type AttachRubroInput = {
  rubroId?: string;
  rubroIds?: string[];
  qty: number;
  unitCost: number;
  type: string;
  duration: string;
  [key: string]: unknown;
};

export type AttachRubroOptions = {
  apiBase: string;
  headers?: HeadersInit;
  fetchImpl?: typeof fetch;
};

export function buildRubroPayload(input: AttachRubroInput) {
  const derivedIds = Array.isArray(input.rubroIds)
    ? input.rubroIds
    : input.rubroId
    ? [input.rubroId]
    : [];

  if (!derivedIds.length) {
    throw new Error("rubroId is required to attach line items");
  }

  return {
    rubroIds: derivedIds,
    qty: input.qty,
    unitCost: input.unitCost,
    type: input.type,
    duration: input.duration,
  };
}

export async function postProjectRubros<T = Record<string, unknown>>(
  projectId: string,
  payload: AttachRubroInput,
  options: AttachRubroOptions,
): Promise<T> {
  const body = JSON.stringify(buildRubroPayload(payload));
  const fetcher = options.fetchImpl ?? fetch;
  const headers = options.headers ?? { "Content-Type": "application/json" };

  const primary = `${options.apiBase}/projects/${encodeURIComponent(
    projectId,
  )}/rubros`;
  let res = await fetcher(primary, {
    method: "POST",
    headers,
    body,
  });

  if (res.status === 404 || res.status === 405) {
    const fallback = `${options.apiBase}/projects/${encodeURIComponent(
      projectId,
    )}/catalog/rubros`;
    res = await fetcher(fallback, { method: "POST", headers, body });
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    throw new Error(`addProjectRubro failed (${res.status}): ${bodyText}`);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

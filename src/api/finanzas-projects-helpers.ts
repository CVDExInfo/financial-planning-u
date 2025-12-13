export type Json = Record<string, unknown>;

export type ProjectsResponse =
  | Json
  | Json[]
  | { data?: Json[]; items?: Json[] };

export function normalizeProjectsPayload(payload: ProjectsResponse): Json[] {
  const candidates = [
    (payload as any)?.data,
    (payload as any)?.items,
    payload,
    (payload as any)?.data?.items,
    (payload as any)?.projects,
    (payload as any)?.Items,
    (payload as any)?.results,
    (payload as any)?.records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Json[];
  }

  return [];
}

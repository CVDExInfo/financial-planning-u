export type Json = Record<string, unknown>;

export type ProjectsResponse =
  | Json
  | Json[]
  | {
      data?: Json[] | Json;
      items?: Json[];
      projects?: Json[];
      Items?: Json[];
      results?: Json[];
      records?: Json[];
      body?: Json;
    };

export function normalizeProjectsPayload(payload: ProjectsResponse): Json[] {
  const candidates = [
    (payload as any)?.data,
    (payload as any)?.items,
    (payload as any)?.data?.items,
    (payload as any)?.projects,
    (payload as any)?.Items,
    (payload as any)?.results,
    (payload as any)?.records,
    (payload as any)?.body,
    (payload as any)?.body?.items,
    (payload as any)?.body?.Items,
    (payload as any)?.body?.results,
    (payload as any)?.body?.records,
    payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Json[];

    if (candidate && typeof candidate === "object") {
      const nested = [
        (candidate as any).data,
        (candidate as any).items,
        (candidate as any).projects,
        (candidate as any).Items,
        (candidate as any).results,
        (candidate as any).records,
      ];

      for (const possibility of nested) {
        if (Array.isArray(possibility)) return possibility as Json[];
      }
    }
  }

  return [];
}

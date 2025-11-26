export type Json = Record<string, unknown>;

export type ProjectsResponse =
  | Json
  | Json[]
  | { data?: Json[]; items?: Json[] };

export function normalizeProjectsPayload(payload: ProjectsResponse): Json[] {
  if (Array.isArray((payload as any)?.data)) return (payload as any).data as Json[];
  if (Array.isArray((payload as any)?.items)) return (payload as any).items as Json[];
  if (Array.isArray(payload)) return payload as Json[];
  if (Array.isArray((payload as any)?.data?.items))
    return ((payload as any).data as any).items as Json[];
  return [];
}

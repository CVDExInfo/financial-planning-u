import { type Project } from "@/types/domain";

export type DisplayProject = {
  id: string;
  code: string;
  name: string;
  client?: string;
};

type ProjectLike = Partial<Project> & {
  projectId?: string;
  project_id?: string;
  pk?: string;
  sk?: string;
  code?: string;
  projectCode?: string;
  project_code?: string;
  name?: string;
  projectName?: string;
  project_name?: string;
  client?: string | null;
  clientName?: string | null;
  client_name?: string | null;
};

export function getProjectDisplay(p: ProjectLike): DisplayProject {
  const rawId =
    p.id || p.projectId || (p as any)?.project_id || p.pk || (p as any)?.sk || "";
  const id = String(rawId).trim();
  const rawCode =
    p.code ||
    (p as any)?.codigo ||
    p.projectCode ||
    (p as any)?.project_code ||
    id;
  const rawName =
    p.name ||
    (p as any)?.nombre ||
    p.projectName ||
    (p as any)?.project_name ||
    "";
  const rawClient = p.client || (p as any)?.cliente || p.clientName || p.client_name;

  const code = String(rawCode || id).trim();
  const name = (String(rawName || "").trim() || "Proyecto sin nombre").trim();
  const client = rawClient ? String(rawClient).trim() : undefined;

  return { id, code: code || id, name, client };
}

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type CreateProjectPayload,
  createProject,
  getProjects,
  FinanzasApiError,
} from "@/api/finanzas";
import { normalizeProjectsPayload } from "@/api/finanzas-projects-helpers";
import { normalizeProjectForUI } from "./normalizeProject";
import { logoutWithHostedUI } from "@/config/aws";

export type ProjectForUI = {
  id: string;
  code: string;
  name: string;
  client: string;
  start_date?: string;
  end_date?: string;
  mod_total: number;
  currency?: string;
  status?: string;
  baseline_id?: string;
  baseline_status?: string | null;
  accepted_by?: string | null;
  baseline_accepted_at?: string | null;
  updated_at?: string;
  created_at?: string;
};

function extractMessage(err: unknown): string {
  if (err instanceof FinanzasApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Ocurrió un error inesperado";
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectForUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const response = await getProjects();
      const items = normalizeProjectsPayload(response);
      const normalized = items.map(normalizeProjectForUI).filter((p) => p.id || p.name);
      setProjects(normalized);
      setError(null);
    } catch (err) {
      if (err instanceof FinanzasApiError && err.status === 401) {
        setError("Sesión expirada, por favor inicia sesión nuevamente.");
        logoutWithHostedUI();
        return;
      }

      const status = err instanceof FinanzasApiError ? err.status : undefined;

      if (status && status >= 400 && status < 500) {
        setError(extractMessage(err));
      } else {
        setError("Error interno en Finanzas. Intenta nuevamente más tarde.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const create = useCallback(
    async (payload: CreateProjectPayload) => {
      try {
        await createProject(payload);
        await load();
      } catch (err) {
        if (err instanceof FinanzasApiError && err.status === 401) {
          setError("Sesión expirada, por favor inicia sesión nuevamente.");
          logoutWithHostedUI();
          throw err;
        }

        const status = err instanceof FinanzasApiError ? err.status : undefined;

        if (status && status >= 400 && status < 500) {
          throw new Error(
            extractMessage(err) ||
              "Los datos del proyecto son inválidos o no tienes permisos para crearlo.",
          );
        }

        throw new Error("Error interno en Finanzas. Intenta nuevamente más tarde.");
      }
    },
    [load],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(
    () => ({ projects, loading, refreshing, error, reload: load, create }),
    [projects, loading, refreshing, error, load, create],
  );
}

export default useProjects;

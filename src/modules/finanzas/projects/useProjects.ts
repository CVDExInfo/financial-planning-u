import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type CreateProjectPayload,
  createProject,
  getProjects,
  FinanzasApiError,
} from "@/api/finanzas";
import {
  normalizeProjectsPayload,
  type Json,
} from "@/api/finanzas-projects-helpers";
import { getProjectDisplay } from "@/lib/projects/display";
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
  updated_at?: string;
  created_at?: string;
};

function normalizeProjectForUI(raw: Json): ProjectForUI {
  const safeString = (value: unknown, fallback = "") =>
    (value ? String(value) : fallback).trim();

  const display = getProjectDisplay(raw as any);
  const updatedAt = safeString(
    raw.updated_at || (raw as any)?.updatedAt || (raw as any)?.last_updated || "",
  );
  const createdAt = safeString(
    raw.created_at || (raw as any)?.createdAt || (raw as any)?.dateCreated || "",
  );

  return {
    id: display.id,
    code: display.code,
    name: display.name,
    client: display.client || "",
    start_date:
      safeString(raw.start_date || raw.fecha_inicio || "") || undefined,
    end_date: safeString(raw.end_date || raw.fecha_fin || "") || undefined,
    mod_total: Number(raw.mod_total ?? raw.presupuesto_total ?? 0) || 0,
    currency: safeString(raw.currency || raw.moneda || "USD"),
    status: safeString(raw.status || raw.estado || "Activo"),
    updated_at: updatedAt || undefined,
    created_at: createdAt || undefined,
  } as ProjectForUI;
}

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

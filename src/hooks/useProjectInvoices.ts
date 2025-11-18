import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getInvoices } from "@/api/finanzas";
import { useProject } from "@/contexts/ProjectContext";
import type { InvoiceDoc } from "@/types/domain";

const invoicesKey = (projectId?: string) =>
  ["invoices", projectId ?? "none"] as const;

export function useProjectInvoices() {
  const { selectedProject } = useProject();
  const projectId = selectedProject?.id;
  const queryClient = useQueryClient();

  const query = useQuery<InvoiceDoc[]>({
    queryKey: invoicesKey(projectId),
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project is required before loading invoices");
      }
      return getInvoices(projectId);
    },
    enabled: !!projectId,
    refetchOnWindowFocus: false,
  });

  const invoices = useMemo(() => query.data ?? [], [query.data]);

  const invalidate = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: invoicesKey(projectId) });
  }, [projectId, queryClient]);

  return {
    ...query,
    projectId,
    invoices,
    invalidate,
  };
}

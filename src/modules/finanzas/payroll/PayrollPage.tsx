import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import PayrollUploader from "./PayrollUploader";
import { FolderKanban } from "lucide-react";

export default function PayrollPage() {
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Payroll Actual"
        badge="Carga rápida"
        description="Carga nómina real por línea o en bloque para refrescar dashboards y resúmenes."
        icon={<FolderKanban className="h-5 w-5 text-white" />}
      />

      <PayrollUploader onUploaded={handleRefresh} />
    </div>
  );
}

import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

export function HomePage() {
  const { currentRole } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1220] via-[#0c1628] to-[#0b1424] text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-white">
              Finanzas SD - Portal
            </h1>
            <p className="text-lg text-slate-300 max-w-3xl">
              Bienvenido al portal Finanzas SD. Gestiona costos, presupuestos y operaciones financieras.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <Badge variant="outline" className="border-slate-700 bg-slate-800/50">
              Rol activo: {currentRole}
            </Badge>
            <span className="hidden sm:inline">Permisos dinámicos aplicados en navegación y rutas.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

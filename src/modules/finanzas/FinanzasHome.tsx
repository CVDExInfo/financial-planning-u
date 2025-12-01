import { Link } from "react-router-dom";
import {
  BarChart3,
  Building2,
  FolderKanban,
  Layers,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Waypoints,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";

const tiles = [
  {
    title: "Proyectos",
    description: "Crear y gestionar proyectos financieros con presupuestos y asignaciones.",
    href: "/projects",
    icon: <FolderKanban className="h-5 w-5" />,
  },
  {
    title: "Catálogo de Rubros",
    description:
      "Lista enriquecida de rubros con taxonomía, línea contable y tipo de costo.",
    href: "/catalog/rubros",
    icon: <Waypoints className="h-5 w-5" />,
  },
  {
    title: "Reglas de Asignación",
    description: "Vista previa de reglas MVP (driver percent, fixed, tickets, hours).",
    href: "/rules",
    icon: <Settings2 className="h-5 w-5" />,
  },
  {
    title: "Ajustes Presupuestarios",
    description: "Gestionar excesos, reducciones y reasignaciones de presupuesto.",
    href: "/adjustments",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: "Flujo de Caja",
    description: "Monitorea ingresos, egresos y margen mensual usando datos existentes.",
    href: "/cashflow",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Forecast SDMT",
    description: "Visualiza y ajusta forecast mensual por proyecto, conectado con conciliación e invoices.",
    href: "/sdmt/cost/forecast",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    title: "Escenarios",
    description: "Compara escenarios frente al baseline con gráficos reutilizados.",
    href: "/scenarios",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    title: "Proveedores",
    description: "Registrar y administrar proveedores y vendors del sistema.",
    href: "/providers",
    icon: <Building2 className="h-5 w-5" />,
  },
];

export default function FinanzasHome() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <PageHeader
        title="Finanzas · Gestión Presupuesto"
        badge="R1"
        description="Consolida costos de proyectos, rubros y facturación en un solo lugar, con trazabilidad completa para Finanzas y Service Delivery de Ikusi."
        icon={<FolderKanban className="h-5 w-5 text-white" />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.title} to={tile.href} className="group h-full">
            <Card className="h-full border-border/80 hover:border-primary/60 transition-colors shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {tile.icon}
                  </div>
                  <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {tile.title}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs leading-relaxed">
                  {tile.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Explora esta sección para validar flujos, cargar datos y confirmar permisos.
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed border-border/80 bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">¿Qué puedes hacer en Finanzas SD?</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Accede a lo esencial para gestión financiera y Service Delivery.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Consultar y gestionar proyectos con su MOD autorizado.</li>
              <li>Revisar el catálogo de rubros y las reglas de asignación de costos.</li>
              <li>Cargar y conciliar facturas por proyecto y periodo.</li>
              <li>Visualizar escenarios de flujo de caja y forecast a nivel portafolio.</li>
            </ul>

            <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-3">
              <p className="mb-2 font-medium text-foreground">Recorrido sugerido</p>
              <ol className="space-y-1 pl-4">
                <li>
                  <Link to="/projects" className="text-foreground hover:text-primary">
                    1. Selecciona un proyecto
                  </Link>
                </li>
                <li>
                  <Link to="/sdmt/cost/catalog" className="text-foreground hover:text-primary">
                    2. Revisa el catálogo de costos
                  </Link>
                </li>
                <li>
                  <Link to="/sdmt/cost/forecast" className="text-foreground hover:text-primary">
                    3. Administra forecast y conciliación
                  </Link>
                </li>
                <li>
                  <Link to="/sdmt/cost/reconciliation" className="text-foreground hover:text-primary">
                    4. Ajusta facturas y conciliación por periodo
                  </Link>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

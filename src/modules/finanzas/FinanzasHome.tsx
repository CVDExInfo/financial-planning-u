import { Link, useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Waypoints,
  TrendingUp,
  ShieldCheck,
  BarChart3,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";

const tiles = [
  {
    title: "Resumen Ejecutivo",
    description: "Visión consolidada de KPIs y resúmenes financieros por portafolio.",
    href: "/sdmt/cost/forecast-v2",
    icon: <FolderKanban className="h-5 w-5" />,
  },
  {
    title: "Gestión de Pronóstico",
    description: "Visualiza y ajusta forecast mensual por proyecto.",
    href: "/sdmt/cost/forecast",
    icon: <TrendingUp className="h-5 w-5" />,
  },
  {
    title: "Conciliación de Facturas",
    description: "Conciliación y control de invoices por proyecto y periodo.",
    href: "/sdmt/cost/reconciliation",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Cambios y Ajustes",
    description: "Gestionar excesos, reducciones y reasignaciones de presupuesto.",
    href: "/adjustments",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
  {
    title: "Estructura de Costos",
    description: "Catálogo y taxonomía de rubros y líneas contables.",
    href: "/sdmt/cost/catalog",
    icon: <Waypoints className="h-5 w-5" />,
  },
  {
    title: "Planificador",
    description: "Herramientas de planificación para alinear timeline y recursos.",
    href: "/pmo/prefactura/estimator",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    title: "Linea Bases Proyectos de Servicio",
    description: "Rastrea la entrega y aceptación de las líneas base de proyectos.",
    href: "/pmo/baselines",
    icon: <FolderKanban className="h-5 w-5" />,
  },
];

export default function FinanzasHomeSMO() {
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <PageHeader
        title="Gestión Presupuesto - SMO"
        badge="SMO"
        description="Consolida costos de proyectos, rubros y facturación con trazabilidad para SMO."
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
          <CardTitle className="text-sm">¿Qué puedes hacer en Gestión Presupuesto - SMO?</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Accede a lo esencial para la gestión de presupuestos y control de costos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Consultar y gestionar proyectos con su MOD autorizado.</li>
              <li>Revisar la estructura de costos y catálogo de rubros.</li>
              <li>Conciliar facturas e integrar con el forecast por proyecto.</li>
            </ul>

            <div className="rounded-md border border-dashed border-border/60 bg-background/40 p-3">
              <p className="mb-2 font-medium text-foreground">Recorrido sugerido</p>
              <ol className="space-y-1 pl-4">
                <li>
                  <Link to="/sdmt/cost/forecast-v2" className="text-foreground hover:text-primary">
                    1. Revisión ejecutiva
                  </Link>
                </li>
                <li>
                  <Link to="/sdmt/cost/catalog" className="text-foreground hover:text-primary">
                    2. Estructura de costos
                  </Link>
                </li>
                <li>
                  <Link to="/sdmt/cost/forecast" className="text-foreground hover:text-primary">
                    3. Gestión de pronóstico y conciliación
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

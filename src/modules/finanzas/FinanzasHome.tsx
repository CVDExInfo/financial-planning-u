import { Link } from "react-router-dom";
import { BarChart3, Building2, FolderKanban, Layers, Settings2, ShieldCheck, Waypoints } from "lucide-react";
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
        description="Módulo inicial para proyectos, catálogos y reglas de asignación. Todo con branding Ikusi/CVDEx y preparado para producción."
        icon={<FolderKanban className="h-5 w-5 text-white" />}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.title} to={tile.href} className="group h-full">
            <Card className="h-full border-border/80 hover:border-primary/60 transition-colors shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 text-primary p-2">{tile.icon}</div>
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    {tile.title}
                  </CardTitle>
                </div>
                <CardDescription className="text-sm leading-relaxed">
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
          <CardTitle className="text-base">Próximos incrementos</CardTitle>
          <CardDescription>
            Persistencia en DynamoDB, edición avanzada de reglas, asignaciones automáticas y panel de costos consolidado.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

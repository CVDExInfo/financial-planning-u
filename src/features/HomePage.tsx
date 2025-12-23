import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Sparkles, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loginWithHostedUI } from "@/config/aws";
import { useAuth } from "@/hooks/useAuth";
import { getDefaultRouteForRole } from "@/lib/auth";

export function HomePage() {
  const navigate = useNavigate();
  const { currentRole, canAccessRoute: userCanAccessRoute } = useAuth();

  const pmoDefaultPath = getDefaultRouteForRole("PMO");
  const prefacturasEntryPath = "/prefacturas/login";

  const canAccessPMO = userCanAccessRoute(pmoDefaultPath);
  const canAccessSDMT = userCanAccessRoute("/sdmt/cost/catalog");

  const navigateToPMO = () => navigate(pmoDefaultPath);
  const navigateToPrefacturas = () => window.location.assign(prefacturasEntryPath);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1220] via-[#0c1628] to-[#0b1424] text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
              Finanzas SD · Ikusi
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-white">
                Financial Planning &amp; Service Delivery Portal
              </h1>
              <p className="text-lg text-slate-300 max-w-3xl">
                Administra presupuestos, catálogos y estimaciones desde un solo lugar. Navega
                entre Finanzas, SDMT y PMO con permisos claros y una experiencia unificada.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">Accesos por rol</p>
                  <p className="text-sm text-slate-300">
                    PMO, SDMT y Vendor ven solo los módulos y rutas permitidos.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">Listo para producción</p>
                  <p className="text-sm text-slate-300">
                    CloudFront + Cognito + API Gateway ya configurados para /finanzas.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Badge variant="outline" className="border-slate-700 bg-slate-800/50">
                Rol activo: {currentRole}
              </Badge>
              <span className="hidden sm:inline">Permisos dinámicos aplicados en navegación y rutas.</span>
            </div>
          </div>

          <Card className="bg-white/5 border-white/10 shadow-2xl backdrop-blur">
            <CardContent className="space-y-6 p-8">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.2em] text-primary">Módulos</p>
                <h2 className="text-2xl font-semibold text-white">Elige a dónde ingresar</h2>
                <p className="text-slate-300 text-sm">
                  Inicia sesión con Cognito para continuar. Los accesos secundarios están listos para PMO y Prefacturas.
                </p>
              </div>

              <div className="space-y-3">
                <Button size="lg" className="w-full" onClick={() => loginWithHostedUI()}>
                  Acceso a Finanzas
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-primary/40 text-primary"
                  onClick={navigateToPMO}
                  disabled={!canAccessPMO}
                >
                  PMO Portal
                  {!canAccessPMO && <Shield className="h-4 w-4 ml-2 opacity-60" />}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={navigateToPrefacturas}
                >
                  Prefacturas Portal
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 text-sm text-slate-200">
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                  <span>SDMT Cost Catalog &amp; Reconciliation</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {canAccessSDMT ? "Disponible" : "Rol requerido"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                  <span>PMO Planificador Proyectos de Servicio</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {canAccessPMO ? "Disponible" : "Rol requerido"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, LayoutDashboard } from "lucide-react";

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
  const prefacturasEntryPath = "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";
  const gestorDeActasUrl = "https://d7t9x3j66yd8k.cloudfront.net/";

  const canAccessPMO = userCanAccessRoute(pmoDefaultPath);
  const canAccessSDMT = userCanAccessRoute("/sdmt/cost/catalog");

  const navigateToGestorDeActas = () => window.open(gestorDeActasUrl, "_blank");
  const navigateToPrefacturas = () => window.open(prefacturasEntryPath, "_blank");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0b1220] via-[#0c1628] to-[#0b1424] text-slate-100">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
              Ikusi - Central de Operaciones
            </Badge>
            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight text-white">
                Ikusi · Central de Operaciones
              </h1>
              <p className="text-lg text-slate-300 max-w-3xl">
                Plataforma operativa para SDM, PMO, ingenieros y proveedores — un punto único para acceder a recursos, gestionar flujos de trabajo, tramitar aprobaciones y facilitar la operación diaria del equipo.
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
                    PMO, SDM, Ingenieros y Vendors ven únicamente los módulos y rutas habilitados para su rol.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">Sesión y seguridad</p>
                  <p className="text-sm text-slate-300">
                    El acceso a Finanzas se realiza mediante Cognito Hosted UI. Los accesos directos abren las aplicaciones correspondientes sin modificar la configuración de autenticación.
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
                <p className="text-sm uppercase tracking-[0.2em] text-primary">Accesos</p>
                <h2 className="text-2xl font-semibold text-white">Accesos rápidos</h2>
                <p className="text-slate-300 text-sm">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
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
                  onClick={navigateToGestorDeActas}
                >
                  Gestor de Actas
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={navigateToPrefacturas}
                >
                  Prefacturas Proveedores
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 text-sm text-slate-200">
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                  <span>Catálogo de Costes SDMT &amp; Reconciliación</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {canAccessSDMT ? "Disponible" : "Rol requerido"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3">
                  <span>Gestor de Actas (PMO)</span>
                  <Badge variant="secondary" className="text-[11px]">
                    {canAccessPMO ? "Disponible" : "Rol requerido"}
                  </Badge>
                </div>
              </div>

              {/* Resources */}
              <div className="mt-4">
                <p className="text-sm uppercase tracking-[0.2em] text-primary mb-3">Recursos</p>
                <div className="grid gap-2">
                  <a
                    href="https://ikusi.my.salesforce.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm text-slate-200">Login | Salesforce</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </a>

                  <a
                    href="https://ikusi.service-now.com/colombia"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm text-slate-200">SERVICENOW</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </a>

                  <a
                    href="https://login.microsoftonline.com/a1885afe-fe31-45ba-b980-33ea356fca94/oauth2/authorize?client%5Fid=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&response%5Fmode=form%5Fpost&response%5Ftype=code%20id%5Ftoken&resource=00000003%2D0000%2D0ff1%2Dce00%2D000000000000&scope=openid&nonce=D00368B99ED43CF46E0F5C5C3B065B446B5D9F0F9049F557%2D422D4A5CFEDB3720169865790E342EB4881AF980255483438FEDCDFCD4A898A9&redirect%5Furi=https%3A%2F%2Fvelatia%2Esharepoint%2Ecom%2F%5Fforms%2Fdefault%2Easpx&state=OD0w&claims=%7B%22id%5Ftoken%22%3A%7B%22xms%5Fcc%22%3A%7B%22values%22%3A%5B%22CP1%22%5D%7D%7D%7D&wsucxt=1&cobrandid=11bd8083%2D87e0%2D41b5%2Dbb78%2D0bc43c8a8e8a&client%2Drequest%2Did=2ebdefa1%2Df04d%2Da000%2D5a41%2D0b1d3e280e59&sso_reload=true"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm text-slate-200">Horas Extras</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </a>

                  <a
                    href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm text-slate-200">CISCO CCW</span>
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </a>
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

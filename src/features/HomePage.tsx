import { ArrowRight, Shield, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loginWithHostedUI } from "@/config/aws";
import { useAuth } from "@/hooks/useAuth";

export function HomePage() {
  const { currentRole } = useAuth();

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
                  <Shield className="h-5 w-5" />
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
                <p className="text-sm uppercase tracking-[0.2em] text-primary">Accesos rápidos</p>
                <h2 className="text-2xl font-semibold text-white">Accesos rápidos</h2>
                <p className="text-slate-300 text-sm">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  size="lg" 
                  className="w-full" 
                  onClick={() => loginWithHostedUI()}
                  aria-label="Acceso a Finanzas"
                >
                  Acceso a Finanzas
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full border-primary/40 text-primary"
                  onClick={() => window.open('https://d7t9x3j66yd8k.cloudfront.net/', '_blank')}
                  aria-label="Gestor de Actas - acceso directo"
                >
                  Gestor de Actas
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full"
                  onClick={() => window.open('https://df7rl707jhpas.cloudfront.net/prefacturas/facturas', '_blank')}
                  aria-label="Prefacturas Proveedores - acceso directo"
                >
                  Prefacturas Proveedores
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">Recursos</h3>
                  <div className="grid gap-2 text-sm">
                    <a 
                      href="https://ikusi.my.salesforce.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <span className="text-white font-medium">Login | Salesforce</span>
                        <p className="text-xs text-slate-300">Acceso al CRM corporativo</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </a>
                    <a 
                      href="https://ikusidev.service-now.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <span className="text-white font-medium">SERVICENOW</span>
                        <p className="text-xs text-slate-300">Gestión de incidencias y solicitudes (Colombia)</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </a>
                    <a 
                      href="https://horasextras.ikusi.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <span className="text-white font-medium">Horas Extras</span>
                        <p className="text-xs text-slate-300">Portal para gestión de horas extraordinarias y autorizaciones</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </a>
                    <a 
                      href="https://apps.cisco.com/Commerce/home" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <span className="text-white font-medium">CISCO CCW</span>
                        <p className="text-xs text-slate-300">Portal Cisco para pedidos y licencias</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </a>
                  </div>
                  <p className="text-xs text-slate-400 mt-3">¿Necesitas acceso? Contacta con tu administrador de sistemas.</p>
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

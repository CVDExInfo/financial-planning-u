import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LoginPage() {
  const { login, isLoading } = useAuth();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex items-center gap-3 text-sm font-medium text-emerald-400">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
            <Logo />
          </div>
          Finanzas · Portal seguro
        </div>

        <Card className="overflow-hidden border-emerald-700/40 bg-slate-900/60 shadow-2xl backdrop-blur">
          <div className="grid gap-10 lg:grid-cols-5">
            <div className="flex flex-col justify-between gap-8 border-b border-slate-800/80 bg-slate-900/60 p-8 lg:col-span-3 lg:border-b-0 lg:border-r lg:p-12">
              <div className="space-y-3">
                <CardTitle className="text-3xl font-semibold leading-tight text-slate-50 sm:text-4xl">
                  Financial Planning &amp; Service Delivery Portal
                </CardTitle>
                <CardDescription className="text-base text-slate-300">
                  Centraliza presupuestos, control de proveedores y conciliaciones para los equipos de Finanzas y Servicio Profesional.
                </CardDescription>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-inner">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-50">PMO Portal</p>
                    <p className="text-sm text-slate-300">
                      Seguimiento de proyectos, aprobaciones y visibilidad integral para líderes de PMO.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center bg-slate-800 text-slate-100 hover:bg-slate-700"
                    onClick={() => {
                      // TODO: Navegación al portal PMO
                    }}
                  >
                    Ir al PMO Portal
                  </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-inner">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-50">Prefactura Portal</p>
                    <p className="text-sm text-slate-300">
                      Captura, validación y conciliación de prefacturas con trazabilidad para Finanzas SD.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center bg-slate-800 text-slate-100 hover:bg-slate-700"
                    onClick={() => {
                      // TODO: Navegación al portal de Prefacturas
                    }}
                  >
                    Ir al Portal de Prefacturas
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6 p-8 lg:col-span-2 lg:p-12">
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-400">Acceso al módulo</p>
                <h2 className="text-2xl font-semibold text-slate-50">Acceso a Finanzas</h2>
                <p className="text-sm text-slate-300">
                  Accede al módulo Finanzas SD. Te redirigiremos al portal de autenticación de Cognito y volverás automáticamente.
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 text-sm text-slate-50 shadow-inner">
                <p className="font-semibold">Acceso seguro</p>
                <p className="mt-1 text-slate-300">
                  Usa tu cuenta corporativa Ikusi. Tu sesión se valida en el Hosted UI y regresas a Finanzas con tus permisos.
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                className="h-11 w-full justify-center bg-emerald-500 text-slate-950 transition hover:bg-emerald-400 lg:w-auto"
                onClick={login}
                disabled={isLoading}
              >
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                Ir a la pantalla de inicio de sesión
              </Button>

              <p className="text-left text-xs text-slate-400 lg:text-right">
                Usa tu cuenta corporativa Ikusi. No compartas tus credenciales.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

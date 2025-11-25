import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ArrowRight, Building2, ShieldCheck, FileSpreadsheet } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, session, canAccessRoute } = useAuth();
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  const sessionEmail = useMemo(
    () =>
      isAuthenticated && session.user ? session.user.email ?? session.user.login : null,
    [isAuthenticated, session.user]
  );

  const handleAccess = (
    path: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {}
  ) => {
    setAccessMessage(null);

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (requiresRoleCheck && !canAccessRoute(normalizedPath)) {
      setAccessMessage(
        "Acceso restringido a roles PMO o equivalentes. Solicita permisos si necesitas entrar."
      );
      return;
    }

    try {
      if (normalizedPath.includes("/pmo")) {
        localStorage.setItem("cv.module", "pmo");
      }
    } catch {
      /* ignore storage errors */
    }

    if (!isAuthenticated) {
      login();
      return;
    }

    navigate(normalizedPath);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.18),transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-900/80" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:120px_120px] opacity-30" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex items-center gap-3 text-sm font-medium text-emerald-300/90">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30">
            <Logo className="h-8" />
          </div>
          Finanzas SD · Acceso seguro Ikusi
        </div>

        <Card className="relative overflow-hidden border border-white/10 bg-slate-950/70 shadow-2xl shadow-emerald-900/30 backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-indigo-500/10" />
          <div className="relative grid gap-10 lg:grid-cols-5 p-8 lg:p-10">
            <div className="flex flex-col justify-between gap-8 lg:col-span-3">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-white/10">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Portal corporativo cifrado
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold leading-tight sm:text-4xl text-white">
                    Finanzas Access · Ikusi
                  </h1>
                  <p className="text-base text-slate-200/90">
                    Autentícate con Cognito Hosted UI para ingresar al módulo Finanzas SD, gestionar prefacturas y colaborar con PMO sin fricción.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-md shadow-black/20">
                  <p className="text-sm font-semibold text-white">Experiencia consistente</p>
                  <p className="mt-2 text-sm text-slate-200/80">
                    Interfaz alineada al diseño oscuro digital de Finanzas SD. Todo el flujo conserva los colores Ikusi.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-md shadow-black/20">
                  <p className="text-sm font-semibold text-white">Sesión protegida</p>
                  <p className="mt-2 text-sm text-slate-200/80">
                    El inicio se realiza desde el Hosted UI de Cognito y regresa al portal sin cambiar la configuración de autenticación.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-5 lg:col-span-2">
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 shadow-lg shadow-black/30">
                <p className="text-sm font-semibold text-emerald-200">Entradas rápidas</p>
                <p className="mt-1 text-xs text-slate-200/80">
                  Usa tu cuenta corporativa Ikusi. CVDEx se mantiene solo en el pie de página del sistema.
                </p>
                {isAuthenticated && (
                  <p className="mt-3 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 ring-1 ring-emerald-400/30">
                    Sesión activa{sessionEmail ? `: ${sessionEmail}` : ""}. Continúa sin volver a iniciar sesión.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-12 w-full justify-between bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  onClick={() => handleAccess("/", { requiresRoleCheck: false })}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <LogIn className="h-5 w-5" aria-hidden="true" />
                    Acceso a Finanzas SD
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-12 w-full justify-between bg-slate-800 text-slate-50 hover:bg-slate-700"
                  onClick={() => handleAccess("/pmo/prefactura/estimator", { requiresRoleCheck: true })}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                    Entrar a PMO Prefacturas
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 w-full justify-between border-white/20 bg-slate-900/60 text-slate-50 hover:bg-slate-800"
                  onClick={() => handleAccess("/pmo/prefactura/estimator")}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                    Entrar a Prefacturas
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>

              {accessMessage ? (
                <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-inner shadow-amber-900/30">
                  {accessMessage}
                </div>
              ) : (
                <p className="text-xs text-slate-300/80">
                  Compatible con laptop y tablet: el contenido se adapta sin superponer el logo ni las descripciones.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

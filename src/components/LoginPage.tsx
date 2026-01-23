/* src/components/LoginPage.tsx
   Final: table-aligned layout (logo left, centered titles, portal left, summary right,
   three-column Recursos | Otras Plataformas | Accesos rápidos).
   Keeps auth/navigation and portal behavior intact.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LogIn,
  ArrowRight,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  MoonStar,
  SunMedium,
  ExternalLink,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

/** Small presentational ResourceLink */
function ResourceLink({
  href,
  title,
  subtitle,
  ariaLabel,
}: {
  href: string;
  title: string;
  subtitle?: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel ?? `${title} - ${subtitle ?? ""}`}
      className="flex items-center justify-between gap-4 rounded-lg border border-slate-200/60 bg-white/90 px-3 py-3 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-900/60 dark:hover:bg-slate-800"
    >
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {title}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 truncate">{subtitle}</p>
        )}
      </div>
      <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
    </a>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, session, canAccessRoute } = useAuth();
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  // Derive initial appearance from DOM / preferences when available
  const initialAppearance = useMemo<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (root.dataset.appearance === "dark" || root.classList.contains("dark")) return "dark";
      if (root.dataset.appearance === "light") return "light";
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)
        return "dark";
    }
    return "light";
  }, []);

  const [appearance, setAppearance] = useState<"light" | "dark">(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const PMO_PORTAL_LOGIN =
    rawActaUrl && rawActaUrl.length > 0 ? rawActaUrl : "https://d7t9x3j66yd8k.cloudfront.net/login";

  const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
  const PREFACTURAS_PORTAL_LOGIN =
    rawPrefacturasUrl && rawPrefacturasUrl.length > 0
      ? rawPrefacturasUrl
      : "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";

  const sessionEmail = useMemo(
    () => (isAuthenticated && session.user ? session.user.email ?? session.user.login : null),
    [isAuthenticated, session.user],
  );

  const handleAccess = (
    path: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {},
  ) => {
    setAccessMessage(null);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (requiresRoleCheck && !canAccessRoute(normalizedPath)) {
      setAccessMessage("Acceso restringido a roles autorizados. Solicita permisos si necesitas entrar.");
      return;
    }

    try {
      if (normalizedPath.startsWith("/pmo")) localStorage.setItem("cv.module", "pmo");
    } catch {
      // ignore storage errors
    }

    if (!isAuthenticated) {
      login();
      return;
    }

    navigate(normalizedPath);
  };

  const handlePortalAccess = (
    url: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {},
  ) => {
    setAccessMessage(null);
    if (requiresRoleCheck && !canAccessRoute("/pmo/prefactura/estimator")) {
      setAccessMessage("Acceso restringido al portal PMO Prefacturas. Solicita permisos al administrador si necesitas entrar.");
      return;
    }

    try {
      window.location.assign(url);
    } catch {
      setAccessMessage("No pudimos abrir el portal solicitado. Intenta nuevamente o contacta soporte.");
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (previousAppearance.current === undefined) {
      previousAppearance.current = root.dataset.appearance ?? (root.classList.contains("dark") ? "dark" : "light");
    }
    root.dataset.appearance = appearance;
    if (appearance === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [appearance]);

  useEffect(
    () => () => {
      if (typeof document === "undefined") return;
      const root = document.documentElement;
      if (previousAppearance.current === "dark") {
        root.dataset.appearance = "dark";
        root.classList.add("dark");
      } else if (previousAppearance.current === "light") {
        root.dataset.appearance = "light";
        root.classList.remove("dark");
      } else {
        delete root.dataset.appearance;
        root.classList.remove("dark");
      }
    },
    [],
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-900 dark:text-slate-50">
      {/* Background grids */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_82%_6%,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.14),transparent_38%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.18),transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-slate-50/70 to-slate-100/75 dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-900/80" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:140px_140px] opacity-25 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-30" />

      {/* Header grid: logo left, centered titles, appearance toggle right */}
      <div className="relative mx-auto w-full max-w-6xl px-6 py-6 sm:px-8 lg:px-8">
        <div className="grid grid-cols-12 items-center gap-4">
          <div className="col-span-2 flex items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-200 shadow-inner dark:bg-emerald-500/10 dark:ring-emerald-400/40">
              <Logo className="h-12" />
            </div>
          </div>

          <div className="col-span-8 text-center">
            <div className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Ikusi · Central de Operaciones
            </div>
            <div className="text-base font-semibold text-emerald-600 dark:text-emerald-200 mt-1">
              Dirección de Operaciones IKUSI Colombia
            </div>
            <p className="mt-4 text-center text-lg text-slate-700 dark:text-slate-200/90 font-medium">
              Existimos para entregar excelencia con empatía y actitud que inspiran confianza
            </p>
          </div>

          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-200/70 bg-white/80 text-emerald-800 shadow-sm hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900/60 dark:text-emerald-100"
              onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
            >
              {appearance === "dark" ? (
                <>
                  <SunMedium className="h-4 w-4" aria-hidden="true" />
                  Modo claro
                </>
              ) : (
                <>
                  <MoonStar className="h-4 w-4" aria-hidden="true" />
                  Modo oscuro
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Centered card with portal + summary + three-column area */}
      <div className="relative w-full flex justify-center px-6 pb-16 sm:px-8 lg:pb-20">
        <Card className="mx-auto w-full max-w-6xl relative overflow-hidden border border-slate-200/80 bg-white/90 shadow-xl shadow-emerald-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:shadow-2xl dark:shadow-emerald-900/30">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 opacity-95 dark:from-emerald-500/10 dark:via-sky-500/5 dark:to-indigo-500/10" />
          <div className="relative grid gap-6 p-8 lg:grid-cols-3 lg:p-10">
            {/* Left: wide portal panel */}
            <div className="lg:col-span-2">
              <div className="rounded-md border-2 border-emerald-700/30 p-6">
                <div className="text-xl font-semibold text-emerald-700">Portal corporativo cifrado</div>
                <div className="mt-3 text-emerald-600 font-medium">Ikusi · Central de Operaciones</div>
                <p className="mt-4 text-base text-slate-700 dark:text-slate-200/90">
                  Plataforma operativa para SDM, PMO, ingenieros y proveedores — un punto único para acceder a recursos, gestionar flujos de trabajo, tramitar aprobaciones y facilitar la operación diaria del equipo.
                </p>
              </div>
            </div>

            {/* Right: compact summary */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-lg dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50">
                <div className="text-sm font-semibold text-emerald-700">Accesos rápidos</div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-200/80 text-right">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
                </p>
              </div>
            </div>

            {/* Three-column row: Recursos | Otras Plataformas | Accesos rápidos */}
            <div className="col-span-full mt-6 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {/* Recursos */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4">Recursos</h3>
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-6 text-slate-900 shadow-md dark:border-white/10 dark:bg-slate-900/80 dark:text-white text-left">
                  <p className="text-sm font-semibold">Sesión y seguridad</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
                    El acceso a Ikusi · Central de Operaciones se realiza mediante Cognito Hosted.
                  </p>

                  <div className="mt-5">
                    <p className="text-sm font-semibold">Accesos por rol</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
                      PMO, SDM, Ingenieros y Vendors ven únicamente los módulos y rutas habilitados para su rol.
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold">Políticas y guías</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
                      Accede a las guías operativas y procedimientos que rigen las actividades de operación.
                    </p>
                  </div>

                  <div className="mt-5">
                    <p className="text-sm font-semibold">Soporte y contacto</p>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
                      ¿Necesitas ayuda o acceso? Contacta a tu administrador o al equipo de soporte local.
                    </p>
                  </div>
                </div>
              </div>

              {/* Otras Plataformas */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4">Otras Plataformas</h3>
                <div className="space-y-3">
                  <ResourceLink
                    href="https://ikusi.my.salesforce.com/"
                    title="Login | Salesforce"
                    subtitle="Acceso al CRM corporativo"
                    ariaLabel="Login Salesforce - Acceso al CRM corporativo"
                  />
                  <ResourceLink
                    href="https://ikusi.service-now.com/colombia"
                    title="SERVICENOW"
                    subtitle="Gestión de incidencias y solicitudes (Colombia)"
                    ariaLabel="ServiceNow - Gestión de incidencias y solicitudes Colombia"
                  />
                  <ResourceLink
                    href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                    title="CISCO CCW"
                    subtitle="Portal Cisco para pedidos y licencias"
                    ariaLabel="CISCO CCW - Portal Cisco para pedidos y licencias"
                  />
                </div>
              </div>

              {/* Accesos rápidos column */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 mb-4">Accesos rápidos</h3>

                <div className="space-y-3">
                  <Button
                    type="button"
                    size="md"
                    className="w-full justify-center bg-emerald-500 text-white"
                    onClick={() => handleAccess("/")}
                    disabled={isLoading}
                  >
                    Acceso a Finanzas SMO
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="w-full justify-center"
                    onClick={() => handlePortalAccess(PMO_PORTAL_LOGIN, { requiresRoleCheck: true })}
                    disabled={isLoading}
                  >
                    Gestor de Actas
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-full justify-center"
                    onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_LOGIN)}
                    disabled={isLoading}
                  >
                    Prefacturas Proveedores
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="w-full justify-center"
                    onClick={() => handlePortalAccess("https://extra-hours-ikusi-ui--valencia94.github.app")}
                    disabled={isLoading}
                  >
                    Horas Extras
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    className="w-full justify-center"
                    onClick={() => handlePortalAccess("https://centrix.example")}
                    disabled={isLoading}
                  >
                    Centrix
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom microcopy */}
            <div className="col-span-full mt-6 px-6 pb-8">
              <p className="text-xs text-slate-600 dark:text-slate-400 italic text-center">
                Compatible con laptop y tablet. El diseño se adapta para evitar que el logo o las descripciones se solapen.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

/* src/components/LoginPage.tsx
   Improved balancing + unblock Gestor de Actas / Prefacturas buttons.
   Minimal, safe presentational updates only.
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

/**
 * Small presentational ResourceLink component (keeps accessibility & consistent layout)
 */
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
      className="flex items-center justify-between gap-4 rounded-lg border border-slate-200/60 bg-white/80 px-3 py-2 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {title}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
            {subtitle}
          </p>
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

  const initialAppearance = useMemo<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (root.dataset.appearance === "dark" || root.classList.contains("dark")) {
        return "dark";
      }
      if (root.dataset.appearance === "light") {
        return "light";
      }
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  }, []);

  const [appearance, setAppearance] = useState<"light" | "dark">(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const PMO_PORTAL_LOGIN =
    rawActaUrl && rawActaUrl.length > 0
      ? rawActaUrl
      : "https://d7t9x3j66yd8k.cloudfront.net/login";

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
      setAccessMessage("Necesitas permisos para acceder. Contacta con tu administrador de sistemas.");
      return;
    }

    try {
      if (normalizedPath.startsWith("/pmo")) {
        localStorage.setItem("cv.module", "pmo");
      }
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

    // If a role-check is requested and user can't access, surface friendly message
    if (requiresRoleCheck && !canAccessRoute("/pmo/prefactura/estimator")) {
      setAccessMessage("Necesitas permisos para acceder. Contacta con tu administrador de sistemas.");
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
      previousAppearance.current =
        root.dataset.appearance ?? (root.classList.contains("dark") ? "dark" : "light");
    }
    root.dataset.appearance = appearance;
    if (appearance === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
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
      {/* Decorative gradients / grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_82%_6%,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.14),transparent_38%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.18),transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-slate-50/70 to-slate-100/75 dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-900/80" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:140px_140px] opacity-25 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-30" />

      {/* Page container: smaller max width to reduce large empty margins on ultra-wide screens */}
      <div className="relative mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Header with logo and appearance toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-base font-semibold text-emerald-800 dark:text-emerald-100">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-200 shadow-inner dark:bg-emerald-500/10 dark:ring-emerald-400/40">
              <Logo className="h-10 sm:h-12" />
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-200/90">
                Dirección de Operaciones IKUSI Colombia
              </span>
              <span className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Central de Operaciones — Ikusi
              </span>

              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-200/90">
                Existimos para entregar excelencia con empatía y actitud que inspiran confianza.
              </p>
            </div>
          </div>

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

        {/* Main card: use 3-column grid (2/1 split) to reduce center gap */}
        <Card className="relative overflow-hidden border border-slate-200/80 bg-white/90 shadow-xl shadow-emerald-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:shadow-2xl dark:shadow-emerald-900/30">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 opacity-95 dark:from-emerald-500/10 dark:via-sky-500/5 dark:to-indigo-500/10" />
          <div className="relative grid gap-8 p-6 lg:grid-cols-3 lg:p-8">
            {/* Left column – headline + feature tiles (2/3 width) */}
            <div className="flex flex-col justify-start gap-6 lg:col-span-2">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/15">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Portal corporativo cifrado
                </div>

                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold leading-tight sm:text-5xl md:text-[2.6rem]">
                    Accesos rápidos
                  </h1>
                  <p className="max-w-2xl text-base text-slate-700 dark:text-slate-200/90">
                    Plataforma operativa para SDM, PMO, ingenieros y proveedores — un punto único para acceder a recursos, gestionar flujos de trabajo, tramitar aprobaciones y facilitar la operación diaria del equipo.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-slate-900 shadow-md shadow-emerald-100/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:shadow-black/20">
                  <p className="text-sm font-semibold">Accesos por rol</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
                    PMO, SDM, Ingenieros y Vendors ven únicamente los módulos y rutas habilitados para su rol.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/90 p-4 text-slate-900 shadow-md shadow-emerald-100/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:shadow-black/20">
                  <p className="text-sm font-semibold">Sesión y seguridad</p>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200/80">
                    El acceso a Finanzas se realiza mediante Cognito Hosted UI. Los accesos directos abren las aplicaciones correspondientes sin modificar la configuración de autenticación.
                  </p>
                </div>
              </div>
            </div>

            {/* Right column – quick entries (1/3 width) */}
            <div className="flex flex-col justify-center gap-5 lg:col-span-1">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-lg shadow-emerald-100/80 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-black/30">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">Accesos rápidos</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-200/80">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
                </p>
                {isAuthenticated && (
                  <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30">
                    Sesión activa{sessionEmail ? `: ${sessionEmail}` : ""}. Continúa sin volver a iniciar sesión.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  aria-label="Acceso a Finanzas - inicia sesión con Cognito Hosted UI"
                  className="h-12 w-full justify-between bg-emerald-500 text-emerald-950 hover:bg-emerald-400 dark:text-emerald-50"
                  onClick={() => handleAccess("/", { requiresRoleCheck: false })}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <LogIn className="h-5 w-5" aria-hidden="true" />
                    Acceso a Finanzas
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>

                {/* OBS: removed role-check for Gestor de Actas — opens portal directly */}
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="h-12 w-full justify-between bg-slate-800 text-slate-50 hover:bg-slate-700 dark:bg-slate-800/90"
                  onClick={() => handlePortalAccess(PMO_PORTAL_LOGIN)}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                    Gestor de Actas
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>

                {/* OBS: removed role-check for Prefacturas Proveedores — opens portal directly */}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 w-full justify-between border-slate-200 bg-white text-slate-900 hover:bg-slate-100 dark:border-white/20 dark:bg-slate-900/60 dark:text-slate-50 dark:hover:bg-slate-800"
                  onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_LOGIN)}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                    Prefacturas Proveedores
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>

              {/* Resources */}
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-lg shadow-emerald-100/80 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-black/30">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200 mb-3">Recursos</p>
                <div className="space-y-2">
                  <ResourceLink
                    href="https://ikusi.my.salesforce.com/"
                    title="Login | Salesforce"
                    subtitle="Acceso al CRM corporativo"
                    ariaLabel="Login Salesforce - Acceso al CRM corporativo (se abre en nueva pestaña)"
                  />
                  <ResourceLink
                    href="https://ikusi.service-now.com/colombia"
                    title="SERVICENOW"
                    subtitle="Gestión de incidencias y solicitudes (Colombia)"
                    ariaLabel="ServiceNow - Gestión de incidencias y solicitudes Colombia (se abre en nueva pestaña)"
                  />
                  <ResourceLink
                    href="https://extra-hours-ikusi-ui--valencia94.github.app"
                    title="Horas Extras"
                    subtitle="Portal para gestión de horas extraordinarias y autorizaciones"
                    ariaLabel="Horas Extras - Portal para gestión de horas extraordinarias y autorizaciones (se abre en nueva pestaña)"
                  />
                  <ResourceLink
                    href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                    title="CISCO CCW"
                    subtitle="Portal Cisco para pedidos y licencias"
                    ariaLabel="CISCO CCW - Portal Cisco para pedidos y licencias (se abre en nueva pestaña)"
                  />
                </div>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 italic">
                  ¿Necesitas acceso? Contacta con tu administrador de sistemas.
                </p>
              </div>

              {accessMessage ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-inner shadow-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {accessMessage}
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300/80">
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

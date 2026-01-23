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

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, session, canAccessRoute } = useAuth();
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  // Derive initial appearance from DOM / preferences when available
  const initialAppearance = useMemo<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;

      if (root.dataset.appearance === "dark" || root.classList.contains("dark")) {
        return "dark";
      }

      if (root.dataset.appearance === "light") {
        return "light";
      }

      if (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
      ) {
        return "dark";
      }
    }

    return "light";
  }, []);

  const [appearance, setAppearance] = useState<"light" | "dark">(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  // External entry points for other modules (same CloudFront distribution)
  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const PMO_PORTAL_LOGIN =
    rawActaUrl && rawActaUrl.length > 0
      ? rawActaUrl
      : "https://d7t9x3j66yd8k.cloudfront.net/login";

  if (!rawActaUrl) {
    console.warn(
      "[LoginPage] VITE_ACTA_BASE_URL no está definido; usando fallback para PMO Platform.",
    );
  }

  const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
  const PREFACTURAS_PORTAL_LOGIN =
    rawPrefacturasUrl && rawPrefacturasUrl.length > 0
      ? rawPrefacturasUrl
      : "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";

  if (!rawPrefacturasUrl) {
    console.warn(
      "[LoginPage] VITE_PREFACTURAS_URL no está definido; usando fallback para Prefacturas.",
    );
  }

  const sessionEmail = useMemo(
    () =>
      isAuthenticated && session.user
        ? session.user.email ?? session.user.login
        : null,
    [isAuthenticated, session.user],
  );

  /**
   * Internal access helper — uses our Hosted UI login + in-app routing.
   * Used for Finanzas SD entry (root of this SPA).
   */
  const handleAccess = (
    path: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {},
  ) => {
    setAccessMessage(null);

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (requiresRoleCheck && !canAccessRoute(normalizedPath)) {
      setAccessMessage(
        "Acceso restringido a roles autorizados. Solicita permisos si necesitas entrar.",
      );
      return;
    }

    // Persist module hint when going to PMO routes
    try {
      if (normalizedPath.startsWith("/pmo")) {
        localStorage.setItem("cv.module", "pmo");
      }
    } catch {
      // ignore storage errors
    }

    if (!isAuthenticated) {
      // This will redirect to Cognito Hosted UI and come back via callback.html
      login();
      return;
    }

    navigate(normalizedPath);
  };

  /**
   * External portal access — sends the user to another SPA / login portal.
   * Used for PMO Prefacturas + Prefacturas buttons.
   */
  const handlePortalAccess = (
    url: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {},
  ) => {
    setAccessMessage(null);

    // For PMO portal we optionally enforce that the current user has PMO access
    if (requiresRoleCheck && !canAccessRoute("/pmo/prefactura/estimator")) {
      setAccessMessage(
        "Acceso restringido al portal PMO Prefacturas. Solicita permisos al administrador si necesitas entrar.",
      );
      return;
    }

    try {
      window.location.assign(url);
    } catch {
      setAccessMessage(
        "No pudimos abrir el portal solicitado. Intenta nuevamente o contacta soporte.",
      );
    }
  };

  // Apply current appearance to the root element so Tailwind dark: variants work
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    if (previousAppearance.current === undefined) {
      previousAppearance.current =
        root.dataset.appearance ??
        (root.classList.contains("dark") ? "dark" : "light");
    }

    root.dataset.appearance = appearance;

    if (appearance === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [appearance]);

  // Cleanup: restore original appearance when this page unmounts
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
      {/* Digital grid + gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.16),transparent_38%),radial-gradient(circle_at_82%_6%,rgba(56,189,248,0.18),transparent_42%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.14),transparent_38%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.2),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.25),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.18),transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-slate-50/70 to-slate-100/75 dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-900/80" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:140px_140px] opacity-25 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-30" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* Header chip + appearance toggle */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-base font-semibold text-emerald-800 dark:text-emerald-100">
          <div className="flex items-center gap-4">
            {/* Bigger logo badge */}
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-200 shadow-inner shadow-emerald-100/80 dark:bg-emerald-500/10 dark:ring-emerald-400/40 dark:shadow-emerald-900/40">
              <Logo className="h-10 sm:h-12" />
            </div>

            {/* Stronger title hierarchy */}
            <div className="flex flex-col leading-tight">
              <span className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-200/90">
                Ikusi - Central de Operaciones
              </span>
              <span className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Ikusi · Central de Operaciones
              </span>

              {/* Mi Hermano copy */}
              <div className="mt-1 text-sm text-slate-600 dark:text-slate-200">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  Dirección de Operaciones IKUSI Colombia
                </p>
                <p className="mt-1 max-w-2xl">
                  Existimos para entregar excelencia con empatía y actitud que inspiran confianza
                </p>
                <p className="mt-1 italic text-xs text-slate-500 dark:text-slate-400">
                  Centrado
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 border-emerald-200/70 bg-white/80 text-emerald-800 shadow-sm hover:bg-emerald-50 dark:border-white/10 dark:bg-slate-900/60 dark:text-emerald-100 dark:hover:bg-slate-800"
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

        {/* Main card */}
        <Card className="relative overflow-hidden border border-slate-200/80 bg-white/90 shadow-xl shadow-emerald-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:shadow-2xl dark:shadow-emerald-900/30">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 opacity-95 dark:from-emerald-500/10 dark:via-sky-500/5 dark:to-indigo-500/10" />
          <div className="relative grid gap-10 p-8 lg:grid-cols-5 lg:p-10">
            {/* Left column – headline + feature tiles */}
            <div className="flex flex-col justify-between gap-8 lg:col-span-3">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-white/10 dark:text-emerald-200 dark:ring-white/15">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Portal corporativo cifrado
                </div>
                <div className="space-y-3">
                  <h1 className="text-4xl font-semibold leading-tight sm:text-5xl md:text-[3.2rem]">
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

            {/* Right column – quick entries */}
            <div className="flex flex-col justify-center gap-5 lg:col-span-2">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-lg shadow-emerald-100/80 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-black/30">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                  Accesos rápidos
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-200/80">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
                </p>
                {isAuthenticated && (
                  <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30">
                    Sesión activa
                    {sessionEmail ? `: ${sessionEmail}` : ""}. Continúa sin volver a iniciar
                    sesión.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {/* Finanzas SD – internal SPA */}
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

                {/* PMO Prefacturas – external portal, optional role check */}
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  aria-label="Gestor de Actas - acceso directo (se abre en nueva pestaña)"
                  className="h-12 w-full justify-between bg-slate-800 text-slate-50 hover:bg-slate-700 dark:bg-slate-800/90"
                  onClick={() =>
                    handlePortalAccess(PMO_PORTAL_LOGIN, { requiresRoleCheck: true })
                  }
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                    Gestor de Actas
                  </span>
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Button>

                {/* Prefacturas – external portal, open to vendors / clients */}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  aria-label="Prefacturas Proveedores - acceso directo (se abre en nueva pestaña)"
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

              {/* Resources section */}
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-5 text-slate-900 shadow-lg shadow-emerald-100/80 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-black/30">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-200 mb-3">
                  Recursos
                </p>
                <div className="space-y-2">
                  <a
                    href="https://ikusi.my.salesforce.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Login | Salesforce - Acceso al CRM corporativo"
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/60 bg-white/80 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Login | Salesforce</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Acceso al CRM corporativo</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </a>

                  <a
                    href="https://ikusi.service-now.com/colombia"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="SERVICENOW - Gestión de incidencias y solicitudes (Colombia)"
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/60 bg-white/80 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">SERVICENOW</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Gestión de incidencias y solicitudes (Colombia)</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </a>

                  <a
                    href="https://extra-hours-ikusi-ui--valencia94.github.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Horas Extras - Portal para gestión de horas extraordinarias y autorizaciones"
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/60 bg-white/80 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">Horas Extras</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Portal para gestión de horas extraordinarias y autorizaciones</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </a>

                  <a
                    href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="CISCO CCW - Portal Cisco para pedidos y licencias"
                    className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/60 bg-white/80 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">CISCO CCW</span>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Portal Cisco para pedidos y licencias</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  </a>
                </div>
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 italic">
                  ¿Necesitas acceso? Contacta con tu administrador de sistemas.
                </p>
              </div>

              {accessMessage ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-inner shadow-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100 dark:shadow-amber-900/30">
                  {accessMessage}
                </div>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-300/80">
                  Compatible con laptop y tablet: el contenido se adapta sin superponer el
                  logo ni las descripciones.
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

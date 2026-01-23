// src/components/LoginPage.tsx
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
      className="flex items-center justify-between gap-4 rounded-lg border border-slate-200/60 bg-white/80 px-3 py-2 hover:bg-emerald-50 transition-colors dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{title}</div>
        {subtitle && <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>}
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
      if (root.dataset.appearance === "dark" || root.classList.contains("dark")) return "dark";
      if (root.dataset.appearance === "light") return "light";
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
    }
    return "light";
  }, []);

  const [appearance, setAppearance] = useState<"light" | "dark">(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  // Vite-backed portal URLs
  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const PMO_PORTAL_LOGIN = rawActaUrl && rawActaUrl.length > 0 ? rawActaUrl : "https://d7t9x3j66yd8k.cloudfront.net/";
  if (!rawActaUrl) console.warn("[LoginPage] VITE_ACTA_BASE_URL no está definido; usando fallback para PMO Platform.");

  const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
  const PREFACTURAS_PORTAL_LOGIN =
    rawPrefacturasUrl && rawPrefacturasUrl.length > 0 ? rawPrefacturasUrl : "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";
  if (!rawPrefacturasUrl) console.warn("[LoginPage] VITE_PREFACTURAS_URL no está definido; usando fallback para Prefacturas.");

  const sessionEmail = useMemo(() => (isAuthenticated && session.user ? session.user.email ?? session.user.login : null), [
    isAuthenticated,
    session.user,
  ]);

  const handleAccess = (path: string, { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {}) => {
    setAccessMessage(null);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (requiresRoleCheck && !canAccessRoute(normalizedPath)) {
      setAccessMessage("Necesitas permisos para acceder. Contacta con tu administrador de sistemas.");
      return;
    }

    try {
      if (normalizedPath.startsWith("/pmo")) localStorage.setItem("cv.module", "pmo");
    } catch {
      // ignore
    }

    if (!isAuthenticated) {
      login();
      return;
    }

    navigate(normalizedPath);
  };

  const handlePortalAccess = (url: string, { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {}) => {
    setAccessMessage(null);

    if (requiresRoleCheck && !canAccessRoute("/pmo/prefactura/estimator")) {
      setAccessMessage("Necesitas permisos para acceder. Contacta con tu administrador de sistemas.");
      return;
    }

    try {
      const w = window.open(url, "_blank");
      if (w) {
        try {
          (w as Window & { opener: Window | null }).opener = null;
        } catch {
          // ignore cross-origin
        }
      } else {
        setAccessMessage("No pudimos abrir el portal solicitado. Intenta nuevamente o contacta soporte.");
      }
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
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950/40 via-slate-950 to-slate-900 text-slate-50">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.06),transparent_38%),radial-gradient(circle_at_82%_6%,rgba(59,130,246,0.04),transparent_42%)] opacity-40" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:140px_140px] opacity-10" />

      <div className="relative w-full px-4 py-12">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-800/10 ring-2 ring-emerald-700/20">
                <Logo className="h-10 w-auto text-emerald-200" />
              </div>
              <div className="flex flex-col">
                {/* Keep one H1 only (no duplicate badge) */}
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Ikusi · Central de Operaciones</h1>
                <div className="mt-1 text-sm text-slate-300">
                  <p className="font-semibold text-emerald-200">Dirección de Operaciones IKUSI Colombia</p>
                  <p className="mt-1 max-w-2xl">Existimos para entregar excelencia con empatía y actitud que inspiran confianza</p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-500/30 text-emerald-200"
              onClick={() => setAppearance(appearance === "dark" ? "light" : "dark")}
            >
              {appearance === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>

          <Card className="relative overflow-hidden border border-slate-700/40 bg-slate-900/70 shadow-xl">
            <div className="relative grid gap-8 p-8 lg:grid-cols-4 lg:p-10">
              {/* Left (3/4) - now a 3-tile balanced grid */}
              <div className="lg:col-span-3">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-800/10 px-4 py-1.5 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-700/10">
                    <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    Portal corporativo cifrado
                  </div>

                  <div>
                    <h2 className="text-4xl font-extrabold leading-tight">Accesos rápidos</h2>
                    <p className="mt-2 text-lg text-slate-300 max-w-3xl">
                      Plataforma operativa para SDM, PMO, ingenieros y proveedores — un punto único para acceder a recursos, gestionar flujos de trabajo, tramitar aprobaciones y facilitar la operación diaria del equipo.
                    </p>
                  </div>
                </div>

                {/* Balanced 3-tile grid for left column */}
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Tile 1: Otros recursos (combine Accesos por rol + Sesión y seguridad) */}
                  <div className="rounded-xl border border-slate-700/40 p-4 bg-slate-900/60">
                    <p className="text-sm font-semibold text-emerald-200">Otros recursos</p>
                    <div className="mt-2 text-sm text-slate-300 space-y-2">
                      <div>
                        <p className="font-medium">Accesos por rol</p>
                        <p>PMO, SDM, Ingenieros y Vendors ven únicamente los módulos y rutas habilitados para su rol.</p>
                      </div>
                      <div>
                        <p className="font-medium mt-2">Sesión y seguridad</p>
                        <p>El acceso a Ikusi · Central de Operaciones se realiza mediante Cognito Hosted UI. Los accesos directos abren las aplicaciones correspondientes sin modificar la configuración de autenticación.</p>
                      </div>
                    </div>
                  </div>

                  {/* Tile 2: Documentación / Políticas */}
                  <div className="rounded-xl border border-slate-700/40 p-4 bg-slate-900/60">
                    <p className="text-sm font-semibold text-emerald-200">Políticas y guías</p>
                    <p className="mt-2 text-sm text-slate-300">Accede a las guías operativas y procedimientos que rigen las actividades de operación.</p>
                  </div>

                  {/* Tile 3: Soporte / Contacto */}
                  <div className="rounded-xl border border-slate-700/40 p-4 bg-slate-900/60">
                    <p className="text-sm font-semibold text-emerald-200">Soporte y contacto</p>
                    <p className="mt-2 text-sm text-slate-300">¿Necesitas ayuda o acceso? Contacta a tu administrador o al equipo de soporte local.</p>
                  </div>
                </div>
              </div>

              {/* Right (1/4) */}
              <aside className="lg:col-span-1 flex flex-col gap-4">
                <div className="rounded-xl border border-slate-700/40 p-5 bg-slate-800/60">
                  <p className="text-sm font-semibold text-emerald-200">Accesos rápidos</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
                  </p>

                  {isAuthenticated && <p className="mt-3 rounded-md bg-emerald-800/10 px-3 py-2 text-xs text-emerald-200">Sesión activa{sessionEmail ? `: ${sessionEmail}` : ""}.</p>}
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    type="button"
                    size="lg"
                    aria-label="Acceso a Finanzas SMO - Service Management Office"
                    className="h-12 w-full justify-between bg-emerald-600 text-slate-900 hover:bg-emerald-500"
                    onClick={() => handleAccess("/", { requiresRoleCheck: false })}
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <LogIn className="h-5 w-5" /> Acceso a Finanzas SMO
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    aria-label="Gestor de Actas - acceso directo (se abre en nueva pestaña)"
                    className="h-12 w-full justify-between bg-slate-800 text-slate-100"
                    onClick={() => handlePortalAccess(PMO_PORTAL_LOGIN)}
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Building2 className="h-5 w-5" /> Gestor de Actas
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    aria-label="Prefacturas Proveedores - acceso directo (se abre en nueva pestaña)"
                    className="h-12 w-full justify-between border-slate-700 bg-transparent text-slate-100"
                    onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_LOGIN)}
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <FileSpreadsheet className="h-5 w-5" /> Prefacturas Proveedores
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    aria-label="Horas Extras - módulo interno Ikusi"
                    className="h-12 w-full justify-between border border-slate-700/30 text-slate-100"
                    onClick={() => handleAccess("/horas-extras")}
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <ExternalLink className="h-5 w-5" /> Horas Extras
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    aria-label="Centrix - acceso directo (se abre en nueva pestaña)"
                    className="h-12 w-full justify-between border border-slate-700/30 text-slate-100"
                    onClick={() => handlePortalAccess("https://newcentrix.labikusi.com/")}
                    disabled={isLoading}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <ExternalLink className="h-5 w-5" /> Centrix
                    </span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>

                {/* Resources tile (Horas Extras removed from here) */}
                <div className="rounded-xl border border-slate-700/40 p-4 bg-slate-800/60">
                  <p className="text-sm font-semibold text-emerald-200 mb-3">Recursos</p>
                  <div className="grid gap-2">
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

                  <p className="mt-4 text-xs text-slate-400 italic">¿Necesitas acceso? Contacta con tu administrador de sistemas.</p>
                </div>

                {accessMessage ? (
                  <div className="rounded-lg border border-amber-600 bg-amber-900/10 px-4 py-3 text-sm text-amber-200 mt-2">{accessMessage}</div>
                ) : null}
              </aside>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;

/* src/components/LoginPage.tsx
   Consolidated: screenshot layout + Ikusi enterprise copy + consistent spacing/typography,
   Row 2 titles: Recursos operativos | Plataformas externas | Módulos internos,
   Recursos converted to actionable/link tiles, balanced grid heights, and light/dark support.
*/

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  Headset,
  Lock,
  MoonStar,
  ShieldCheck,
  SunMedium,
  Users,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

/** External platform link tile (new tab) */
function ExternalPlatformLink({
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
      aria-label={ariaLabel ?? `${title}${subtitle ? ` - ${subtitle}` : ""} (se abre en nueva pestaña)`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200/70 bg-white/80 px-4 py-4 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-emerald-50/60 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 dark:border-white/10 dark:bg-slate-900/45 dark:hover:bg-slate-900/60"
    >
      <div className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</div>
        {subtitle && (
          <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300/90">{subtitle}</p>
        )}
      </div>
      <ExternalLink
        className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-[1px]"
        aria-hidden="true"
      />
    </a>
  );
}

type TileAction =
  | { type: "internal"; onClick: () => void }
  | { type: "external"; href: string; newTab?: boolean };

function ResourceTile({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
}: {
  title: string;
  subtitle: string;
  icon: ElementType;
  badge?: string;
  action: TileAction;
}) {
  const base =
    "group flex w-full items-start justify-between gap-4 rounded-xl border px-4 py-4 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60";

  const shell =
    "border-slate-200/70 bg-white/80 hover:-translate-y-[1px] hover:bg-emerald-50/60 hover:shadow-md dark:border-white/10 dark:bg-slate-900/45 dark:hover:bg-slate-900/60";

  const content = (
    <>
      <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-slate-200/60 bg-slate-50/70 text-slate-700 dark:border-white/10 dark:bg-black/10 dark:text-slate-200">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </span>
          {badge ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30">
              {badge}
            </span>
          ) : null}
        </span>

        <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300/90">{subtitle}</span>
      </span>

      {action.type === "external" ? (
        <ExternalLink
          className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-[1px]"
          aria-hidden="true"
        />
      ) : (
        <ArrowRight
          className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-[2px]"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (action.type === "external") {
    return (
      <a
        href={action.href}
        target={action.newTab === false ? undefined : "_blank"}
        rel={action.newTab === false ? undefined : "noopener noreferrer"}
        className={`${base} ${shell}`}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={`${base} ${shell}`} onClick={action.onClick}>
      {content}
    </button>
  );
}

type QuickVariant = "primary" | "neutral" | "outline";

function QuickAccessButton({
  label,
  description,
  icon: Icon,
  onClick,
  disabled,
  variant = "neutral",
}: {
  label: string;
  description?: string;
  icon: ElementType;
  onClick: () => void;
  disabled?: boolean;
  variant?: QuickVariant;
}) {
  const base =
    "group w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3 border transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-55 disabled:cursor-not-allowed";

  const variants: Record<QuickVariant, string> = {
    primary:
      "bg-gradient-to-r from-emerald-500/95 to-emerald-400/90 text-emerald-950 border-emerald-300/20 hover:brightness-[1.02] hover:-translate-y-[1px] hover:shadow-md hover:shadow-emerald-500/20 dark:text-emerald-50",
    neutral:
      "bg-white/80 text-slate-900 border-slate-200/70 hover:bg-slate-50 hover:-translate-y-[1px] hover:shadow-md dark:bg-slate-900/45 dark:text-slate-50 dark:border-white/10 dark:hover:bg-slate-900/60",
    outline:
      "bg-transparent text-slate-900 border-slate-200/80 hover:bg-slate-50 hover:-translate-y-[1px] hover:shadow-md dark:text-slate-50 dark:border-white/20 dark:hover:bg-white/5",
  };

  return (
    <button type="button" className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-black/5 border border-slate-200/60 dark:bg-black/10 dark:border-white/10">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          {description ? (
            <span className="mt-0.5 hidden truncate text-xs text-slate-600/90 dark:text-slate-300/80 lg:block">
              {description}
            </span>
          ) : null}
        </span>
      </span>

      <ArrowRight
        className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-[2px]"
        aria-hidden="true"
      />
    </button>
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
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches)
        return "dark";
    }
    return "dark"; // dark-first
  }, []);

  const [appearance, setAppearance] = useState<"light" | "dark">(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const PMO_PORTAL_LOGIN =
    rawActaUrl && rawActaUrl.length > 0 ? rawActaUrl : "https://d7t9x3j66yd8k.cloudfront.net/";

  const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
  const PREFACTURAS_PORTAL_LOGIN =
    rawPrefacturasUrl && rawPrefacturasUrl.length > 0
      ? rawPrefacturasUrl
      : "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";

  const rawCentrixUrl = import.meta.env.VITE_CENTRIX_URL?.trim();
  const CENTRIX_URL = rawCentrixUrl && rawCentrixUrl.length > 0 ? rawCentrixUrl : null;

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
      setAccessMessage("Acceso restringido. Solicita permisos si necesitas entrar.");
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
      setAccessMessage("Acceso restringido al portal. Solicita permisos al administrador si necesitas entrar.");
      return;
    }

    try {
      window.location.assign(url);
    } catch {
      setAccessMessage("No pudimos abrir el portal solicitado. Intenta nuevamente o contacta soporte.");
    }
  };

  // Disable restricted module for nicer UX
  const canOpenActasPortal = useMemo(
    () => canAccessRoute("/pmo/prefactura/estimator"),
    [canAccessRoute],
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (previousAppearance.current === undefined) {
      previousAppearance.current =
        root.dataset.appearance ?? (root.classList.contains("dark") ? "dark" : "light");
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
      {/* Decorative gradients / grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.16),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(14,116,144,0.14),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.20),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.22),transparent_40%),radial-gradient(circle_at_60%_85%,rgba(14,116,144,0.18),transparent_32%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/85 via-slate-50/70 to-slate-100/75 dark:from-slate-950 dark:via-slate-950/90 dark:to-slate-900/80" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)] bg-[size:140px_140px] opacity-25 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-30" />

      {/* Header */}
      <div className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 items-center gap-4">
          <div className="col-span-2 flex items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 ring-2 ring-emerald-200 shadow-inner dark:bg-emerald-500/10 dark:ring-emerald-400/40">
              <Logo className="h-10" />
            </div>
          </div>

          <div className="col-span-8 text-center">
            <div className="text-xl font-semibold tracking-tight sm:text-2xl">
              Central de Operaciones
            </div>
            <div className="mt-1 text-sm font-semibold text-emerald-700 sm:text-base dark:text-emerald-200/90">
              Dirección de Operaciones · Ikusi Colombia
            </div>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base dark:text-slate-200/90">
              Acceso centralizado, seguro y alineado a tu rol.
            </p>
          </div>

          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-slate-200/70 bg-white/80 text-slate-800 shadow-sm hover:bg-emerald-50 dark:border-white/15 dark:bg-slate-900/60 dark:text-slate-100 dark:hover:bg-slate-900/75"
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

      {/* Main card */}
      <div className="relative flex w-full justify-center px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20">
        <Card className="relative mx-auto w-full max-w-6xl overflow-hidden border border-slate-200/80 bg-white/85 shadow-xl shadow-emerald-200/40 backdrop-blur dark:border-white/10 dark:bg-slate-950/60 dark:shadow-2xl dark:shadow-emerald-900/30">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 opacity-95 dark:from-emerald-500/10 dark:via-sky-500/5 dark:to-indigo-500/10" />

          <div className="relative grid gap-8 p-6 lg:grid-cols-3 lg:p-10">
            {/* Row 1: left hero (2/3) */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-emerald-200/70 bg-white/75 p-7 shadow-sm dark:border-emerald-400/25 dark:bg-slate-950/25">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30">
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Portal corporativo seguro
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight leading-tight sm:text-4xl">
                  Acceso operativo
                </h1>

                <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200/90">
                  Ikusi · Operaciones
                </p>

                <p className="mt-5 max-w-3xl text-sm text-slate-700 sm:text-base dark:text-slate-200/90">
                  Plataforma operativa para SDM, PMO, ingenieros y proveedores. Centraliza recursos,
                  flujos de trabajo y aprobaciones para facilitar la operación diaria.
                </p>

                <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                  Acceso centralizado · Seguridad corporativa · Trazabilidad operativa
                </p>
              </div>
            </div>

            {/* Row 1: right intro (1/3) */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                  Acceso por rol
                </div>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed dark:text-slate-200/90">
                  Inicia sesión con tu cuenta corporativa. Verás únicamente los módulos habilitados según tu rol.
                </p>

                {isAuthenticated ? (
                  <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30">
                    Sesión activa{sessionEmail ? `: ${sessionEmail}` : ""}. Continúa sin volver a iniciar sesión.
                  </p>
                ) : (
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    Inicia sesión para habilitar navegación y módulos internos.
                  </p>
                )}
              </div>
            </div>

            {/* Access message */}
            {accessMessage && (
              <div className="lg:col-span-3">
                <div
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-inner shadow-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100"
                >
                  {accessMessage}
                </div>
              </div>
            )}

            {/* Row 2: 3-column grid (md=2 cols, lg=3 cols). Third spans full width on md. */}
            <div className="lg:col-span-3 mt-2 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
              {/* Recursos operativos */}
              <section className="flex h-full flex-col">
                <h3 className="mb-4 text-center text-lg font-semibold text-slate-900 md:text-xl dark:text-slate-50">
                  Recursos operativos
                </h3>

                <div className="flex h-full flex-1 flex-col rounded-2xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                  <div className="space-y-3">
                    <ResourceTile
                      title="Sesión y seguridad"
                      subtitle="El acceso se autentica mediante AWS Cognito (Hosted UI)."
                      icon={ShieldCheck}
                      badge="Seguridad"
                      action={{ type: "internal", onClick: () => handleAccess("/recursos/seguridad") }}
                    />
                    <ResourceTile
                      title="Acceso por rol"
                      subtitle="Los módulos visibles se ajustan según tu rol corporativo."
                      icon={Users}
                      action={{ type: "internal", onClick: () => handleAccess("/recursos/acceso-por-rol") }}
                    />
                    <ResourceTile
                      title="Políticas y guías"
                      subtitle="Consulta lineamientos, procedimientos y guías vigentes de operación."
                      icon={BookOpen}
                      action={{ type: "internal", onClick: () => handleAccess("/recursos/politicas") }}
                    />
                    <ResourceTile
                      title="Soporte y contacto"
                      subtitle="Canal oficial para incidencias, solicitudes y soporte local."
                      icon={Headset}
                      action={{ type: "external", href: "https://ikusi.service-now.com/colombia" }}
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    Nota: algunos recursos pueden requerir autenticación adicional.
                  </p>
                </div>
              </section>

              {/* Plataformas externas */}
              <section className="flex h-full flex-col">
                <h3 className="mb-4 text-center text-lg font-semibold text-slate-900 md:text-xl dark:text-slate-50">
                  Plataformas externas
                </h3>

                <div className="flex h-full flex-1 flex-col rounded-2xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                  <div className="space-y-3">
                    <ExternalPlatformLink
                      href="https://ikusi.my.salesforce.com/"
                      title="Salesforce"
                      subtitle="Acceso al CRM corporativo"
                      ariaLabel="Salesforce - Acceso al CRM corporativo"
                    />
                    <ExternalPlatformLink
                      href="https://ikusi.service-now.com/colombia"
                      title="ServiceNow"
                      subtitle="Incidencias y solicitudes (Colombia)"
                      ariaLabel="ServiceNow - Incidencias y solicitudes Colombia"
                    />
                    <ExternalPlatformLink
                      href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                      title="Cisco CCW"
                      subtitle="Pedidos y licencias"
                      ariaLabel="Cisco CCW - Pedidos y licencias"
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70 italic">
                    ¿Necesitas acceso? Solicítalo a tu administrador.
                  </p>
                </div>
              </section>

              {/* Módulos internos (span full width on md) */}
              <section className="flex h-full flex-col md:col-span-2 lg:col-span-1">
                <h3 className="mb-4 text-center text-lg font-semibold text-slate-900 md:text-xl dark:text-slate-50">
                  Módulos internos
                </h3>

                <div className="flex h-full flex-1 flex-col rounded-2xl border border-slate-200/70 bg-white/75 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                  <div className="space-y-3">
                    <QuickAccessButton
                      label="Finanzas · SMO"
                      description="Gestión y operación financiera"
                      icon={Building2}
                      variant="primary"
                      onClick={() => handleAccess("/", { requiresRoleCheck: false })}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label={canOpenActasPortal ? "Gestión de Actas" : "Gestión de Actas · Restringido"}
                      description="Seguimiento y actas operativas"
                      icon={canOpenActasPortal ? ShieldCheck : Lock}
                      variant="neutral"
                      onClick={() => handlePortalAccess(PMO_PORTAL_LOGIN, { requiresRoleCheck: true })}
                      disabled={isLoading || !canOpenActasPortal}
                    />

                    <QuickAccessButton
                      label="Prefacturas a Proveedores"
                      description="Registro y consulta de prefacturas"
                      icon={FileSpreadsheet}
                      variant="outline"
                      onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_LOGIN)}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Horas extra"
                      description="Autorizaciones y control"
                      icon={ExternalLink}
                      variant="neutral"
                      onClick={() => handlePortalAccess("https://extra-hours-ikusi-ui--valencia94.github.app")}
                      disabled={isLoading}
                    />

                    {CENTRIX_URL ? (
                      <QuickAccessButton
                        label="Centrix"
                        description="Plataforma adicional"
                        icon={ExternalLink}
                        variant="neutral"
                        onClick={() => handlePortalAccess(CENTRIX_URL)}
                        disabled={isLoading}
                      />
                    ) : null}
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    La disponibilidad de módulos depende de tu rol y permisos asignados.
                  </p>
                </div>
              </section>
            </div>

            {/* Bottom microcopy */}
            <div className="lg:col-span-3 mt-2">
              <p className="text-center text-xs text-slate-500 dark:text-slate-300/70 italic">
                Optimizado para laptop y tablet. El contenido se ajusta para mantener legibilidad y jerarquía visual.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

/* src/components/LoginPage.tsx
   Final (mint/ice light theme):
   - Light-mode default + optional dark toggle
   - Single hero ("Acceso operativo")
   - Row 2: Recursos operativos / Plataformas externas / Módulos internos
   - 5 internal modules (no restrictions/disable)
   - External platforms include Planview + ProjectPlace in correct order
   - Light theme tuned to mint/ice look (less slate, softer grid)
*/

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  LifeBuoy,
  MoonStar,
  ShieldCheck,
  SunMedium,
  Users,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

type Appearance = "light" | "dark";

type TileLinkProps = {
  title: string;
  subtitle: string;
  icon: ElementType;
  badge?: string;
  href?: string;
  openInNewTab?: boolean;
  ariaLabel?: string;
  onMissingHref?: () => void;
};

function TileLink({
  title,
  subtitle,
  icon: Icon,
  badge,
  href,
  openInNewTab = true,
  ariaLabel,
  onMissingHref,
}: TileLinkProps) {
  const base =
    "group flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0";

  // Mint/ice light surface + clear hover (not too green)
  const surface =
    "border-slate-200/70 bg-white/80 hover:bg-emerald-50/60 hover:border-emerald-200/70 hover:-translate-y-[1px] hover:shadow-md " +
    "dark:border-white/10 dark:bg-slate-950/35 dark:hover:bg-slate-900/45 dark:hover:border-emerald-400/25";

  const Left = (
    <span className="mt-0.5 grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-700 shadow-sm dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-100">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );

  const Right = href ? (
    openInNewTab ? (
      <ExternalLink
        className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-[1px]"
        aria-hidden="true"
      />
    ) : (
      <ArrowRight
        className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-hover:translate-x-[2px]"
        aria-hidden="true"
      />
    )
  ) : (
    <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-slate-300" aria-hidden="true" />
  );

  const Content = (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </span>
        {badge ? (
          <span className="flex-shrink-0 rounded-full border border-emerald-200/70 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-200">
            {badge}
          </span>
        ) : null}
      </span>
      <span className="mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-200/80">
        {subtitle}
      </span>
    </span>
  );

  if (!href) {
    return (
      <button
        type="button"
        className={`${base} ${surface}`}
        onClick={onMissingHref}
        aria-label={ariaLabel ?? `${title} - ${subtitle}`}
      >
        {Left}
        {Content}
        {Right}
      </button>
    );
  }

  return (
    <a
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={openInNewTab ? "noopener noreferrer" : undefined}
      className={`${base} ${surface}`}
      aria-label={
        ariaLabel ?? `${title} - ${subtitle}${openInNewTab ? " (se abre en nueva pestaña)" : ""}`
      }
    >
      {Left}
      {Content}
      {Right}
    </a>
  );
}

type QuickVariant = "primary" | "surface";

function QuickAccessButton({
  label,
  subLabel,
  icon: Icon,
  onClick,
  disabled,
  variant = "surface",
}: {
  label: string;
  subLabel: string;
  icon: ElementType;
  onClick: () => void;
  disabled?: boolean;
  variant?: QuickVariant;
}) {
  const base =
    "group w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3 border shadow-sm transition-all " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0 " +
    "disabled:opacity-60 disabled:cursor-not-allowed";

  const variants: Record<QuickVariant, string> = {
    primary:
      "bg-emerald-500 text-emerald-950 border-emerald-400/30 hover:bg-emerald-400 hover:-translate-y-[1px] " +
      "hover:shadow-md hover:shadow-emerald-300/30 dark:text-emerald-950",
    surface:
      // Make non-primary buttons readable in LIGHT mode (no black slabs)
      "bg-white/90 text-slate-900 border-slate-200/80 hover:bg-emerald-50/70 hover:border-emerald-200/80 hover:-translate-y-[1px] hover:shadow-md " +
      "dark:bg-slate-950/35 dark:text-slate-50 dark:border-white/10 dark:hover:bg-slate-900/45 dark:hover:border-emerald-400/25",
  };

  const iconBox =
    variant === "primary"
      ? "bg-black/10 border-black/10"
      : "bg-emerald-50/40 border-slate-200/70 dark:bg-slate-900/50 dark:border-white/10";

  const subText =
    variant === "primary"
      ? "text-emerald-950/80"
      : "text-slate-600 dark:text-slate-200/75";

  return (
    <button
      type="button"
      className={`${base} ${variants[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className={`grid place-items-center h-9 w-9 rounded-lg border ${iconBox}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{label}</span>
          <span className={`block truncate text-xs ${subText}`}>{subLabel}</span>
        </span>
      </span>

      <ArrowRight
        className="h-4 w-4 opacity-75 transition-transform group-hover:translate-x-[2px]"
        aria-hidden="true"
      />
    </button>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, session } = useAuth();
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  // Default is LIGHT
  const initialAppearance = useMemo<Appearance>(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (root.dataset.appearance === "dark" || root.classList.contains("dark")) return "dark";
      if (root.dataset.appearance === "light") return "light";
    }
    return "light";
  }, []);

  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  // External portals (fallbacks preserved)
  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const ACTAS_PORTAL_URL =
    rawActaUrl && rawActaUrl.length > 0 ? rawActaUrl : "https://d7t9x3j66yd8k.cloudfront.net/login";

  const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
  const PREFACTURAS_PORTAL_URL =
    rawPrefacturasUrl && rawPrefacturasUrl.length > 0
      ? rawPrefacturasUrl
      : "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";

  // Internal / resource URLs (env-driven; no placeholders)
  const SECURITY_GUIDE_URL = import.meta.env.VITE_SECURITY_GUIDE_URL?.trim() ?? "";
  const ROLE_GUIDE_URL = import.meta.env.VITE_ROLE_GUIDE_URL?.trim() ?? "";
  const POLICIES_GUIDE_URL = import.meta.env.VITE_POLICIES_GUIDE_URL?.trim() ?? "";
  const SUPPORT_URL =
    (import.meta.env.VITE_SUPPORT_URL?.trim() ?? "") || "https://ikusi.service-now.com/colombia";
  const HOURS_EXTRA_URL = import.meta.env.VITE_HOURS_EXTRA_URL?.trim() ?? "https://extra-hours-ikusi-ui--valencia94.github.app";
  const CENTRIX_URL = import.meta.env.VITE_CENTRIX_URL?.trim() ?? "";

  const handleAccess = (path: string) => {
    setAccessMessage(null);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (!isAuthenticated) {
      login();
      return;
    }

    navigate(normalizedPath);
  };

  const handlePortalAccess = (url: string) => {
    setAccessMessage(null);
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

  const sessionEmail =
    isAuthenticated && session?.user ? (session.user.email ?? session.user.login ?? null) : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-sky-50 text-slate-900 transition-colors dark:from-slate-950 dark:via-slate-950/95 dark:to-slate-900 dark:text-slate-50">
      {/* Mint/ice background (light) + existing dark gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.12),transparent_40%),radial-gradient(circle_at_82%_10%,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_60%_86%,rgba(14,116,144,0.10),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.20),transparent_40%),radial-gradient(circle_at_60%_80%,rgba(14,116,144,0.16),transparent_30%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-emerald-50/40 to-sky-50/55 dark:from-slate-950 dark:via-slate-950/92 dark:to-slate-900/85" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] bg-[size:140px_140px] opacity-15 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-30" />

      {/* Header */}
      <header className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-12 items-center gap-4">
          <div className="col-span-12 sm:col-span-3 flex items-center justify-center sm:justify-start">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/80 ring-2 ring-emerald-200/80 shadow-inner dark:bg-emerald-500/10 dark:ring-emerald-400/30">
              <Logo className="h-12" />
            </div>
          </div>

          <div className="col-span-12 sm:col-span-6 text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Central de Operaciones
            </h1>
            <p className="mt-1 text-base font-semibold text-emerald-700 dark:text-emerald-200/90">
              Dirección de Operaciones · Ikusi Colombia
            </p>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-200/85">
              Acceso centralizado, seguro y alineado a tu rol.
            </p>
          </div>

          <div className="col-span-12 sm:col-span-3 flex justify-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-slate-200/80 bg-white/75 text-slate-700 shadow-sm hover:bg-white hover:text-slate-900 dark:border-white/15 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-900/70"
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
      </header>

      {/* Main card */}
      <section className="relative mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-16">
        <Card className="relative overflow-hidden border border-slate-200/70 bg-white/75 shadow-xl shadow-emerald-200/25 backdrop-blur dark:border-white/10 dark:bg-slate-950/65 dark:shadow-2xl dark:shadow-emerald-900/25">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-sky-50 to-indigo-50 opacity-90 dark:from-emerald-500/10 dark:via-sky-500/5 dark:to-indigo-500/10" />

          <div className="relative grid gap-6 p-6 lg:p-8">
            {/* Hero */}
            <div className="rounded-2xl border border-emerald-200/70 bg-white/75 p-6 shadow-sm dark:border-emerald-400/25 dark:bg-slate-950/30">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-white/15">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Portal corporativo seguro
              </div>

              <div className="mt-5 space-y-2">
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
                  Acceso operativo
                </h2>
                <p className="text-sm sm:text-base font-semibold text-emerald-700 dark:text-emerald-200/90">
                  Ikusi · Operaciones
                </p>
                <p className="mt-3 max-w-4xl text-base text-slate-700 dark:text-slate-200/90">
                  Plataforma operativa para SDM, PMO, ingenieros y proveedores. Centraliza recursos,
                  flujos de trabajo y aprobaciones para facilitar la operación diaria.
                </p>

                <p className="mt-4 text-sm text-slate-500 dark:text-slate-300/70">
                  Acceso centralizado · Seguridad corporativa · Trazabilidad operativa
                </p>

                {isAuthenticated ? (
                  <p className="mt-4 inline-flex items-center rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/30">
                    Sesión activa{sessionEmail ? `: ${sessionEmail}` : ""}. Puedes continuar sin volver a iniciar sesión.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Access message */}
            {accessMessage ? (
              <div
                role="status"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-inner shadow-amber-100 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100"
              >
                {accessMessage}
              </div>
            ) : null}

            {/* Row 2 */}
            <div className="mt-2 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
              {/* Recursos operativos */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg md:text-xl font-semibold text-center text-slate-900 dark:text-slate-50 mb-3">
                  Recursos operativos
                </h3>

                <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/30">
                  <div className="space-y-3">
                    <TileLink
                      icon={ShieldCheck}
                      title="Sesión y seguridad"
                      badge="Seguridad"
                      subtitle="El acceso se autentica mediante AWS Cognito."
                      href={SECURITY_GUIDE_URL || undefined}
                      onMissingHref={() =>
                        setAccessMessage("Enlace de 'Sesión y seguridad' no configurado (VITE_SECURITY_GUIDE_URL).")
                      }
                    />

                    <TileLink
                      icon={Users}
                      title="Acceso por rol"
                      subtitle="Los módulos se ajustan según tu rol corporativo."
                      href={ROLE_GUIDE_URL || undefined}
                      onMissingHref={() =>
                        setAccessMessage("Enlace de 'Acceso por rol' no configurado (VITE_ROLE_GUIDE_URL).")
                      }
                    />

                    <TileLink
                      icon={BookOpen}
                      title="Políticas y guías"
                      subtitle="Lineamientos, procedimientos y guías vigentes de operación."
                      href={POLICIES_GUIDE_URL || undefined}
                      onMissingHref={() =>
                        setAccessMessage("Enlace de 'Políticas y guías' no configurado (VITE_POLICIES_GUIDE_URL).")
                      }
                    />

                    <TileLink
                      icon={LifeBuoy}
                      title="Soporte y contacto"
                      subtitle="Canal oficial para incidencias, solicitudes y soporte local."
                      href={SUPPORT_URL}
                      ariaLabel="Soporte y contacto - se abre en nueva pestaña"
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70">
                    Nota: algunos recursos pueden requerir autenticación adicional.
                  </p>
                </div>
              </div>

              {/* Plataformas externas */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg md:text-xl font-semibold text-center text-slate-900 dark:text-slate-50 mb-3">
                  Plataformas externas
                </h3>

                <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/30 flex flex-col">
                  <div className="space-y-3">
                    <TileLink
                      icon={ExternalLink}
                      title="Salesforce"
                      subtitle="Acceso al CRM corporativo"
                      href="https://ikusi.my.salesforce.com/"
                    />
                    <TileLink
                      icon={ExternalLink}
                      title="Planview"
                      subtitle="Gestión de portafolio y demanda"
                      href="https://ikusi.id.planview.com/"
                    />
                    <TileLink
                      icon={ExternalLink}
                      title="ProjectPlace"
                      subtitle="Seguimiento de proyectos y tableros"
                      href="https://service.projectplace.com/login"
                    />
                    <TileLink
                      icon={ExternalLink}
                      title="ServiceNow"
                      subtitle="Incidencias y solicitudes (Colombia)"
                      href="https://ikusi.service-now.com/colombia"
                    />
                    <TileLink
                      icon={ExternalLink}
                      title="Cisco CCW"
                      subtitle="Pedidos y licencias"
                      href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                    />
                  </div>

                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-300/70 italic">
                    ¿Necesitas acceso? Solicítalo a tu administrador.
                  </p>
                </div>
              </div>

              {/* Módulos internos */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg md:text-xl font-semibold text-center text-slate-900 dark:text-slate-50 mb-3">
                  Módulos internos
                </h3>

                <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white/75 p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/30">
                  <div className="space-y-3">
                    <QuickAccessButton
                      label="Finanzas · SMO"
                      subLabel="Gestión y operación financiera"
                      icon={Building2}
                      variant="primary"
                      onClick={() => handleAccess("/")}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Gestión de Actas"
                      subLabel="Seguimiento y actas operativas"
                      icon={ShieldCheck}
                      variant="surface"
                      onClick={() => handlePortalAccess(ACTAS_PORTAL_URL)}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Prefacturas a Proveedores"
                      subLabel="Registro y consulta de prefacturas"
                      icon={FileSpreadsheet}
                      variant="surface"
                      onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_URL)}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Horas extra"
                      subLabel="Autorizaciones y control"
                      icon={ExternalLink}
                      variant="surface"
                      onClick={() => handlePortalAccess(HOURS_EXTRA_URL)}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Centrix"
                      subLabel="Acceso al portal corporativo"
                      icon={ExternalLink}
                      variant="surface"
                      onClick={() => {
                        if (!CENTRIX_URL) {
                          setAccessMessage("Enlace de Centrix no configurado (VITE_CENTRIX_URL).");
                          return;
                        }
                        handlePortalAccess(CENTRIX_URL);
                      }}
                      disabled={isLoading}
                    />
                  </div>

                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-200/75">
                    La disponibilidad de módulos depende de tu rol y permisos asignados.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs text-slate-500 dark:text-slate-300/70 italic text-center">
                Optimizado para laptop y tablet. El contenido se ajusta para mantener legibilidad y jerarquía visual.
              </p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}

export default LoginPage;

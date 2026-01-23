/* src/components/LoginPage.tsx
   Final: Ikusi “Central de Operaciones” layout with:
   - Light mode default + optional dark toggle (persisted)
   - Single hero section (no right-side “Acceso por rol” tile)
   - Row 2: 3 equal columns with balanced spacing + equal-height tiles
   - 5 “Módulos internos” (no access restrictions / no role gating)
   - “Plataformas externas” includes Salesforce, Planview, ProjectPlace, then the rest
   - Centrix URL updated
   - Improved hover/contrast so ALL tiles feel interactive (not only Finance)
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Clock3,
  ExternalLink,
  FileSpreadsheet,
  Headphones,
  LayoutGrid,
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
type TileKind = "action" | "external";

function Tile({
  kind,
  title,
  subtitle,
  badge,
  icon: Icon,
  onClick,
  href,
  targetBlank = false,
  variant = "neutral",
  ariaLabel,
}: {
  kind: TileKind;
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ElementType;
  onClick?: () => void;
  href?: string;
  targetBlank?: boolean;
  variant?: "neutral" | "primary";
  ariaLabel?: string;
}) {
  const base =
    "group w-full min-h-[72px] rounded-2xl border px-4 py-3.5 flex items-center justify-between gap-4 " +
    "transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 " +
    "hover:-translate-y-[1px] hover:shadow-md";

  const neutral =
    "bg-white/70 border-slate-200/70 text-slate-900 hover:bg-emerald-50/60 hover:border-emerald-300/60 " +
    "dark:bg-slate-950/35 dark:border-white/10 dark:text-slate-50 dark:hover:bg-slate-900/60 dark:hover:border-emerald-400/25";

  const primary =
    "bg-gradient-to-r from-emerald-600 to-emerald-500 border-emerald-500/40 text-white " +
    "hover:brightness-[1.02] hover:shadow-emerald-500/20 " +
    "dark:from-emerald-500 dark:to-emerald-400 dark:border-emerald-300/25";

  const rightIcon =
    kind === "external" ? (
      <ExternalLink
        className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-[2px]"
        aria-hidden="true"
      />
    ) : (
      <ArrowRight
        className="h-4 w-4 opacity-70 transition-transform group-hover:translate-x-[2px]"
        aria-hidden="true"
      />
    );

  const content = (
    <>
      <span className="flex items-center gap-3 min-w-0">
        <span
          className={
            "grid place-items-center h-10 w-10 rounded-xl border " +
            "bg-white/70 border-slate-200/70 text-slate-700 " +
            "dark:bg-white/5 dark:border-white/10 dark:text-slate-200 " +
            (variant === "primary" ? " !bg-black/10 !border-white/15 !text-white" : "")
          }
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>

        <span className="min-w-0 text-left">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate">{title}</span>
            {badge ? (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset">
                <span
                  className={
                    "rounded-full px-2 py-0.5 " +
                    "bg-emerald-50 text-emerald-800 ring-emerald-200/70 " +
                    "dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20"
                  }
                >
                  {badge}
                </span>
              </span>
            ) : null}
          </span>

          <span className="mt-1 block text-xs leading-snug text-slate-600 dark:text-slate-200/80 truncate">
            {subtitle}
          </span>
        </span>
      </span>

      {rightIcon}
    </>
  );

  const computedAria =
    ariaLabel ??
    `${title} — ${subtitle}${kind === "external" && targetBlank ? " (se abre en nueva pestaña)" : ""}`;

  if (href) {
    return (
      <a
        href={href}
        target={targetBlank ? "_blank" : undefined}
        rel={targetBlank ? "noopener noreferrer" : undefined}
        aria-label={computedAria}
        className={`${base} ${variant === "primary" ? primary : neutral}`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      aria-label={computedAria}
      onClick={onClick}
      className={`${base} ${variant === "primary" ? primary : neutral}`}
    >
      {content}
    </button>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Default = LIGHT (persist user choice)
  const initialAppearance = useMemo<Appearance>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("ikusi.appearance");
    if (stored === "dark" || stored === "light") return stored;
    // explicit default requested: light (ignore system unless already set elsewhere)
    return "light";
  }, []);

  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const previousAppearance = useRef<string | undefined>(undefined);

  // Portals (environment overrides preserved)
  const rawActaUrl = import.meta.env.VITE_ACTA_BASE_URL?.trim();
  const PMO_PORTAL_LOGIN =
    rawActaUrl && rawActaUrl.length > 0 ? rawActaUrl : "https://d7t9x3j66yd8k.cloudfront.net/login";

  const rawPrefacturasUrl = import.meta.env.VITE_PREFACTURAS_URL?.trim();
  const PREFACTURAS_PORTAL_LOGIN =
    rawPrefacturasUrl && rawPrefacturasUrl.length > 0
      ? rawPrefacturasUrl
      : "https://df7rl707jhpas.cloudfront.net/prefacturas/facturas";

  const CENTRIX_URL = "https://newcentrix.labikusi.com/";

  const openInternalRoute = (path: string) => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // Keep your auth behavior for internal navigation
    if (!isAuthenticated) {
      login();
      return;
    }
    navigate(normalizedPath);
  };

  const openPortalSameTab = (url: string) => {
    try {
      window.location.assign(url);
    } catch {
      // no-op: browser blocked or navigation error
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

    try {
      window.localStorage.setItem("ikusi.appearance", appearance);
    } catch {
      // ignore
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

  const recursos = [
    {
      title: "Sesión y seguridad",
      subtitle: "El acceso se autentica mediante AWS Cognito (Hosted UI).",
      badge: "Seguridad",
      icon: ShieldCheck,
      href: "https://ikusi.service-now.com/colombia",
      targetBlank: true,
    },
    {
      title: "Acceso por rol",
      subtitle: "Los módulos visibles se ajustan según tu rol corporativo.",
      icon: Users,
      href: "https://ikusi.service-now.com/colombia",
      targetBlank: true,
    },
    {
      title: "Políticas y guías",
      subtitle: "Consulta lineamientos, procedimientos y guías vigentes de operación.",
      icon: BookOpen,
      href: "https://ikusi.service-now.com/colombia",
      targetBlank: true,
    },
    {
      title: "Soporte y contacto",
      subtitle: "Canal oficial para incidencias, solicitudes y soporte local.",
      icon: Headphones,
      href: "https://ikusi.service-now.com/colombia",
      targetBlank: true,
    },
  ] as const;

  const plataformas = [
    {
      title: "Salesforce",
      subtitle: "Acceso al CRM corporativo",
      href: "https://ikusi.my.salesforce.com/",
    },
    {
      title: "Planview",
      subtitle: "Gestión de portafolio y demanda",
      href: "https://ikusi.id.planview.com/",
    },
    {
      title: "ProjectPlace",
      subtitle: "Seguimiento de proyectos y tableros",
      href: "https://service.projectplace.com/login",
    },
    {
      title: "ServiceNow",
      subtitle: "Incidencias y solicitudes (Colombia)",
      href: "https://ikusi.service-now.com/colombia",
    },
    {
      title: "Cisco CCW",
      subtitle: "Pedidos y licencias",
      href: "https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw",
    },
  ] as const;

  const modulos = [
    {
      title: "Finanzas · SMO",
      subtitle: "Gestión y operación financiera",
      icon: Building2,
      variant: "primary" as const,
      onClick: () => openInternalRoute("/"),
    },
    {
      title: "Gestión de Actas",
      subtitle: "Seguimiento y actas operativas",
      icon: LayoutGrid,
      variant: "neutral" as const,
      onClick: () => openPortalSameTab(PMO_PORTAL_LOGIN),
    },
    {
      title: "Prefacturas a Proveedores",
      subtitle: "Registro y consulta de prefacturación",
      icon: FileSpreadsheet,
      variant: "neutral" as const,
      onClick: () => openPortalSameTab(PREFACTURAS_PORTAL_LOGIN),
    },
    {
      title: "Horas extra",
      subtitle: "Autorizaciones y control",
      icon: Clock3,
      variant: "neutral" as const,
      onClick: () => openPortalSameTab("https://extra-hours-ikusi-ui--valencia94.github.app"),
    },
    {
      title: "Centrix",
      subtitle: "Acceso al portal corporativo",
      icon: ExternalLink,
      variant: "neutral" as const,
      onClick: () => openPortalSameTab(CENTRIX_URL),
    },
  ] as const;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-50">
      {/* Background (light + dark variants) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.16),transparent_45%),radial-gradient(circle_at_82%_0%,rgba(56,189,248,0.12),transparent_48%),radial-gradient(circle_at_60%_88%,rgba(14,116,144,0.12),transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(14,116,144,0.18),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(2,6,23,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(2,6,23,0.05)_1px,transparent_1px)] bg-[size:160px_160px] opacity-35 dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] dark:opacity-25" />

      {/* Header */}
      <header className="relative mx-auto w-full max-w-6xl px-6 pt-8 pb-6 sm:px-8">
        <div className="grid grid-cols-12 items-center gap-4">
          {/* Logo */}
          <div className="col-span-12 sm:col-span-2 flex justify-center sm:justify-start">
            <div className="rounded-2xl border border-emerald-200/70 bg-white/75 px-5 py-4 shadow-sm backdrop-blur dark:border-emerald-400/20 dark:bg-slate-950/35">
              <Logo className="h-12 sm:h-14" />
            </div>
          </div>

          {/* Titles */}
          <div className="col-span-12 sm:col-span-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
              Central de Operaciones
            </h1>
            <div className="mt-2 text-sm sm:text-base font-semibold text-emerald-700 dark:text-emerald-300">
              Dirección de Operaciones · Ikusi Colombia
            </div>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-200">
              Existimos para entregar excelencia con empatía y actitud que inspiran confianza.
            </p>
          </div>

          {/* Appearance toggle */}
          <div className="col-span-12 sm:col-span-2 flex justify-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-slate-200/70 bg-white/70 text-slate-900 shadow-sm hover:bg-white/90 dark:border-white/15 dark:bg-slate-950/35 dark:text-slate-100 dark:hover:bg-slate-900/50"
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

      {/* Main container */}
      <section className="relative mx-auto w-full max-w-6xl px-6 pb-14 sm:px-8">
        <Card className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/55 shadow-2xl backdrop-blur dark:border-white/10 dark:bg-slate-950/35">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-indigo-500/10 dark:from-emerald-500/10 dark:via-sky-500/5 dark:to-indigo-500/10" />

          <div className="relative p-6 sm:p-8 lg:p-10">
            {/* Hero (single section) */}
            <div className="rounded-3xl border border-emerald-200/70 bg-white/55 p-7 shadow-sm dark:border-emerald-400/20 dark:bg-slate-950/25">
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-inset bg-emerald-50 text-emerald-900 ring-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-400/20">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Portal corporativo seguro
              </div>

              <div className="mt-6">
                <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  Acceso operativo
                </h2>
                <div className="mt-2 text-base font-semibold text-emerald-700 dark:text-emerald-300">
                  Ikusi · Operaciones
                </div>

                <p className="mt-5 max-w-4xl text-lg leading-relaxed text-slate-700 dark:text-slate-200">
                  Plataforma operativa para SDM, PMO, ingenieros y proveedores. Centraliza recursos, flujos de
                  trabajo y aprobaciones para facilitar la operación diaria.
                </p>

                <p className="mt-6 text-sm text-slate-500 dark:text-slate-300/80">
                  Acceso centralizado · Seguridad corporativa · Trazabilidad operativa
                </p>
              </div>
            </div>

            {/* Row 2 */}
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
              {/* Recursos operativos */}
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-slate-100">
                  Recursos operativos
                </h3>

                <div className="mt-4 flex-1 rounded-3xl border border-slate-200/70 bg-white/55 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                  <div className="space-y-3">
                    {recursos.map((r) => (
                      <Tile
                        key={r.title}
                        kind="external"
                        title={r.title}
                        subtitle={r.subtitle}
                        badge={"badge" in r ? (r as any).badge : undefined}
                        icon={r.icon}
                        href={r.href}
                        targetBlank={r.targetBlank}
                      />
                    ))}
                  </div>

                  <p className="mt-5 text-xs text-slate-500 dark:text-slate-300/70">
                    Nota: algunos recursos pueden requerir autenticación adicional.
                  </p>
                </div>
              </div>

              {/* Plataformas externas */}
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-slate-100">
                  Plataformas externas
                </h3>

                <div className="mt-4 flex-1 rounded-3xl border border-slate-200/70 bg-white/55 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                  <div className="space-y-3">
                    {plataformas.map((p) => (
                      <Tile
                        key={p.title}
                        kind="external"
                        title={p.title}
                        subtitle={p.subtitle}
                        icon={ExternalLink}
                        href={p.href}
                        targetBlank
                      />
                    ))}
                  </div>

                  <p className="mt-5 text-xs italic text-slate-500 dark:text-slate-300/70">
                    ¿Necesitas acceso? Solicítalo a tu administrador.
                  </p>
                </div>
              </div>

              {/* Módulos internos */}
              <div className="flex flex-col">
                <h3 className="text-lg font-bold text-center text-slate-900 dark:text-slate-100">
                  Módulos internos
                </h3>

                <div className="mt-4 flex-1 rounded-3xl border border-slate-200/70 bg-white/55 p-6 shadow-sm dark:border-white/10 dark:bg-slate-950/25">
                  <div className="space-y-3">
                    {modulos.map((m) => (
                      <Tile
                        key={m.title}
                        kind="action"
                        title={m.title}
                        subtitle={m.subtitle}
                        icon={m.icon}
                        onClick={m.onClick}
                        variant={m.variant}
                      />
                    ))}
                  </div>

                  <p className="mt-5 text-sm text-slate-600 dark:text-slate-200/80">
                    La disponibilidad de módulos depende de tu rol y permisos asignados.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer microcopy */}
            <div className="mt-10">
              <p className="text-center text-xs italic text-slate-500 dark:text-slate-300/70">
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

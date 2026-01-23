/* src/components/LoginPage.tsx
   Final: equal-height 3-column grid + upscale "Accesos rápidos" buttons (icon-left + arrow-right),
   while preserving all auth/navigation + portal behavior.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  FileSpreadsheet,
  Lock,
  MoonStar,
  ShieldCheck,
  SunMedium,
} from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

/** Small presentational ResourceLink (kept, but wrapped in a same-size column card) */
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
      aria-label={ariaLabel ?? `${title}${subtitle ? ` - ${subtitle}` : ""}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-900/40 px-4 py-4 shadow-sm transition-all hover:-translate-y-[1px] hover:bg-slate-900/55 hover:shadow-md dark:bg-slate-900/45"
    >
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-semibold text-slate-50 truncate">{title}</div>
        {subtitle && (
          <p className="text-xs text-slate-300/90 mt-1 truncate">{subtitle}</p>
        )}
      </div>

      <ExternalLink
        className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-[1px]"
        aria-hidden="true"
      />
    </a>
  );
}

type QuickVariant = "primary" | "neutral" | "outline";

function QuickAccessButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  variant = "neutral",
}: {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  variant?: QuickVariant;
}) {
  const base =
    "group w-full h-12 rounded-xl px-4 flex items-center justify-between gap-3 border transition-all shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-0 disabled:opacity-55 disabled:cursor-not-allowed";

  const variants: Record<QuickVariant, string> = {
    primary:
      "bg-gradient-to-r from-emerald-500/95 to-emerald-400/90 text-slate-900 border-emerald-300/20 hover:brightness-[1.02] hover:-translate-y-[1px] hover:shadow-md hover:shadow-emerald-500/20",
    neutral:
      "bg-slate-900/45 text-slate-50 border-white/10 hover:bg-slate-900/60 hover:-translate-y-[1px] hover:shadow-md",
    outline:
      "bg-transparent text-slate-50 border-white/25 hover:bg-white/5 hover:-translate-y-[1px] hover:shadow-md",
  };

  return (
    <button
      type="button"
      className={`${base} ${variants[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span className="grid place-items-center h-9 w-9 rounded-lg bg-black/10 border border-white/10">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold truncate">{label}</span>
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

  // Derive initial appearance from DOM / preferences when available
  const initialAppearance = useMemo<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (root.dataset.appearance === "dark" || root.classList.contains("dark")) return "dark";
      if (root.dataset.appearance === "light") return "light";
      if (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches
      )
        return "dark";
    }
    return "dark"; // defaulting to dark since your “reality” design is dark-first
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
      setAccessMessage(
        "Acceso restringido al portal. Solicita permisos al administrador si necesitas entrar.",
      );
      return;
    }

    try {
      window.location.assign(url);
    } catch {
      setAccessMessage("No pudimos abrir el portal solicitado. Intenta nuevamente o contacta soporte.");
    }
  };

  // Precompute access for nicer UX: disable button instead of “let them click and fail”
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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50 transition-colors">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(56,189,248,0.14),transparent_45%),radial-gradient(circle_at_60%_85%,rgba(14,116,144,0.18),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:140px_140px] opacity-30" />

      {/* Header */}
      <div className="relative mx-auto w-full max-w-6xl px-6 py-7 sm:px-8 lg:px-8">
        <div className="grid grid-cols-12 items-center gap-4">
          <div className="col-span-2 flex items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900/60 ring-2 ring-emerald-400/30 shadow-inner">
              <Logo className="h-10" />
            </div>
          </div>

          <div className="col-span-8 text-center">
            <div className="text-lg font-semibold">Ikusi · Central de Operaciones</div>
            <div className="text-base font-semibold text-emerald-300 mt-1">
              Dirección de Operaciones IKUSI Colombia
            </div>
            <p className="mt-4 text-center text-lg text-slate-200/90 font-medium">
              Existimos para entregar excelencia con empatía y actitud que inspiran confianza
            </p>
          </div>

          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-white/15 bg-slate-900/50 text-slate-100 hover:bg-slate-900/70 hover:text-white"
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
      <div className="relative w-full flex justify-center px-6 pb-16 sm:px-8 lg:pb-20">
        <Card className="mx-auto w-full max-w-6xl relative overflow-hidden border border-white/10 bg-slate-950/35 shadow-2xl backdrop-blur">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-indigo-500/10" />

          <div className="relative grid gap-6 p-8 lg:grid-cols-3 lg:p-10">
            {/* Left: portal panel */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-emerald-400/25 bg-slate-950/25 p-7 shadow-sm">
                <div className="text-2xl font-semibold text-emerald-300">
                  Portal corporativo cifrado
                </div>
                <div className="mt-3 text-emerald-200/90 font-medium">
                  Ikusi · Central de Operaciones
                </div>
                <p className="mt-5 text-base text-slate-200/90">
                  Plataforma operativa para SDM, PMO, ingenieros y proveedores — un punto único para
                  acceder a recursos, gestionar flujos de trabajo, tramitar aprobaciones y facilitar
                  la operación diaria del equipo.
                </p>
              </div>
            </div>

            {/* Right: summary */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/25 p-6 shadow-sm">
                <div className="text-sm font-semibold text-emerald-300">Accesos rápidos</div>
                <p className="mt-3 text-sm text-slate-200/85 text-center leading-relaxed">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol.
                  Gestor de Actas y Prefacturas están disponibles como accesos directos.
                </p>
              </div>
            </div>

            {/* Access message (NOW VISIBLE) */}
            {accessMessage && (
              <div className="col-span-full">
                <div
                  role="status"
                  className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                >
                  {accessMessage}
                </div>
              </div>
            )}

            {/* 3-column grid — equal size containers */}
            <div className="col-span-full mt-8 grid grid-cols-1 gap-8 md:grid-cols-3 md:items-stretch">
              {/* Recursos */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg font-bold text-center mb-4">Recursos</h3>

                <div className="flex-1 rounded-2xl border border-white/10 bg-slate-950/25 p-6 shadow-sm">
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-50">Sesión y seguridad</p>
                      <p className="mt-2 text-sm text-slate-200/80">
                        El acceso a Ikusi · Central de Operaciones se realiza mediante Cognito Hosted.
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-50">Accesos por rol</p>
                      <p className="mt-2 text-sm text-slate-200/80">
                        PMO, SDM, Ingenieros y Vendors ven únicamente los módulos y rutas habilitados
                        para su rol.
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-50">Políticas y guías</p>
                      <p className="mt-2 text-sm text-slate-200/80">
                        Accede a las guías operativas y procedimientos que rigen las actividades de
                        operación.
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-50">Soporte y contacto</p>
                      <p className="mt-2 text-sm text-slate-200/80">
                        ¿Necesitas ayuda o acceso? Contacta a tu administrador o al equipo de soporte
                        local.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Otras Plataformas */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg font-bold text-center mb-4">Otras Plataformas</h3>

                <div className="flex-1 rounded-2xl border border-white/10 bg-slate-950/25 p-6 shadow-sm flex flex-col">
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

                  <p className="mt-4 text-xs text-slate-300/80 italic">
                    ¿Necesitas acceso? Contacta con tu administrador de sistemas.
                  </p>
                </div>
              </div>

              {/* Accesos rápidos */}
              <div className="flex flex-col h-full">
                <h3 className="text-lg font-bold text-center mb-4">Accesos rápidos</h3>

                <div className="flex-1 rounded-2xl border border-white/10 bg-slate-950/25 p-6 shadow-sm">
                  <div className="space-y-3">
                    <QuickAccessButton
                      label="Acceso a Finanzas SMO"
                      icon={Building2}
                      variant="primary"
                      onClick={() => handleAccess("/")}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label={canOpenActasPortal ? "Gestor de Actas" : "Gestor de Actas (restringido)"}
                      icon={canOpenActasPortal ? ShieldCheck : Lock}
                      variant="neutral"
                      onClick={() => handlePortalAccess(PMO_PORTAL_LOGIN, { requiresRoleCheck: true })}
                      disabled={isLoading || !canOpenActasPortal}
                    />

                    <QuickAccessButton
                      label="Prefacturas Proveedores"
                      icon={FileSpreadsheet}
                      variant="outline"
                      onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_LOGIN)}
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Horas Extras"
                      icon={ExternalLink}
                      variant="neutral"
                      onClick={() =>
                        handlePortalAccess("https://extra-hours-ikusi-ui--valencia94.github.app")
                      }
                      disabled={isLoading}
                    />

                    <QuickAccessButton
                      label="Centrix"
                      icon={ExternalLink}
                      variant="neutral"
                      onClick={() => handlePortalAccess("https://centrix.example")}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom microcopy */}
            <div className="col-span-full mt-8">
              <p className="text-xs text-slate-300/70 italic text-center">
                Compatible con laptop y tablet. El diseño se adapta para evitar que el logo o las
                descripciones se solapen.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

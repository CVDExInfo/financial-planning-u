/* src/components/LoginPage.tsx
   Balanced & restored visual: font sizes, color palette, and button styles consistent with prior design.
   - Three equal-height columns (Recursos | Otras Plataformas | Accesos rápidos)
   - Upscaled button styles and typographic scale returned
   - Auth/navigation unchanged
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

/** ResourceLink: tuned to match the boxed look from prior design */
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
      className="flex items-center justify-between gap-4 rounded-lg border border-slate-700/60 bg-slate-800/60 px-4 py-3 hover:bg-slate-800/70 transition-colors"
    >
      <div className="flex-1 min-w-0 text-left">
        <div className="text-sm font-semibold text-slate-50">{title}</div>
        {subtitle && <div className="text-xs text-slate-400 mt-1">{subtitle}</div>}
      </div>
      <ExternalLink className="h-4 w-4 text-slate-400 flex-shrink-0" aria-hidden="true" />
    </a>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated, session, canAccessRoute } = useAuth();
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  // Appearance initial state
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
    [isAuthenticated, session.user]
  );

  const handleAccess = (
    path: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {}
  ) => {
    setAccessMessage(null);
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    if (requiresRoleCheck && !canAccessRoute(normalizedPath)) {
      setAccessMessage("Necesitas permisos para acceder. Contacta con tu administrador de sistemas.");
      return;
    }

    try {
      if (normalizedPath.startsWith("/pmo")) localStorage.setItem("cv.module", "pmo");
    } catch {
      /* ignore storage errors */
    }

    if (!isAuthenticated) {
      login();
      return;
    }

    navigate(normalizedPath);
  };

  const handlePortalAccess = (
    url: string,
    { requiresRoleCheck = false }: { requiresRoleCheck?: boolean } = {}
  ) => {
    setAccessMessage(null);

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
    []
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-900 text-slate-50">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 opacity-20" />

      {/* Header: logo left, centered titles, appearance toggle right */}
      <div className="relative mx-auto w-full max-w-7xl px-6 py-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-12 items-center gap-4">
          <div className="col-span-2 flex items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600/10 ring-2 ring-emerald-400/30">
              <Logo className="h-12" />
            </div>
          </div>

          <div className="col-span-8 text-center">
            <div className="text-xl font-semibold text-slate-50">Ikusi · Central de Operaciones</div>
            <div className="text-base font-semibold text-emerald-300 mt-1">Dirección de Operaciones IKUSI Colombia</div>
            <p className="mt-4 text-center text-lg text-slate-300 font-medium">
              Existimos para entregar excelencia con empatía y actitud que inspiran confianza
            </p>
          </div>

          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-emerald-300/40 bg-slate-800/50 text-emerald-200 hover:bg-slate-800/70"
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

      {/* Card */}
      <div className="relative w-full flex justify-center px-6 pb-16 sm:px-8 lg:pb-20">
        <Card className="mx-auto w-full max-w-7xl relative overflow-hidden border border-slate-800/60 bg-slate-900/70 shadow-2xl shadow-emerald-900/40">
          <div className="relative grid gap-6 p-8 lg:grid-cols-3 lg:p-12">
            {/* Left: Portal block (wide) */}
            <div className="lg:col-span-2">
              <div className="rounded-md border border-emerald-600/30 p-6 bg-slate-900/60">
                <div className="text-xl font-semibold text-emerald-400">Portal corporativo cifrado</div>
                <div className="mt-3 text-emerald-300 font-semibold">Ikusi · Central de Operaciones</div>
                <p className="mt-4 text-base text-slate-200">
                  Plataforma operativa para SDM, PMO, ingenieros y proveedores — un punto único para acceder a recursos, gestionar flujos de trabajo, tramitar aprobaciones y facilitar la operación diaria del equipo.
                </p>
              </div>
            </div>

            {/* Right: compact summary */}
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-5 text-slate-50 shadow-md">
                <div className="text-sm font-semibold text-emerald-400">Accesos rápidos</div>
                <p className="mt-2 text-xs text-slate-300 text-right">
                  Accede con tu cuenta corporativa a las herramientas habilitadas según tu rol. Gestor de Actas y Prefacturas están disponibles como accesos directos.
                </p>
              </div>
            </div>

            {/* Lower 3-column area: ensure equal heights */}
            <div className="col-span-full mt-6 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
              {/* Recursos */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-50 mb-4">Recursos</h3>
                <div className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-6 text-left h-full flex flex-col">
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-slate-100">Sesión y seguridad</p>
                    <p className="mt-2 text-sm text-slate-300">
                      El acceso a Ikusi · Central de Operaciones se realiza mediante Cognito Hosted.
                    </p>
                  </div>

                  <div className="mb-5">
                    <p className="text-sm font-semibold text-slate-100">Accesos por rol</p>
                    <p className="mt-2 text-sm text-slate-300">
                      PMO, SDM, Ingenieros y Vendors ven únicamente los módulos y rutas habilitados para su rol.
                    </p>
                  </div>

                  <div className="mb-5">
                    <p className="text-sm font-semibold text-slate-100">Políticas y guías</p>
                    <p className="mt-2 text-sm text-slate-300">
                      Accede a las guías operativas y procedimientos que rigen las actividades de operación.
                    </p>
                  </div>

                  <div className="mt-auto">
                    <p className="text-sm font-semibold text-slate-100">Soporte y contacto</p>
                    <p className="mt-2 text-sm text-slate-300">
                      ¿Necesitas ayuda o acceso? Contacta a tu administrador o al equipo de soporte local.
                    </p>
                  </div>
                </div>
              </div>

              {/* Otras Plataformas */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-50 mb-4">Otras Plataformas</h3>
                <div className="space-y-3 h-full flex flex-col">
                  <div className="flex-1">
                    <ResourceLink
                      href="https://ikusi.my.salesforce.com/"
                      title="Login | Salesforce"
                      subtitle="Acceso al CRM corporativo"
                      ariaLabel="Login Salesforce - Acceso al CRM corporativo"
                    />
                  </div>

                  <div className="flex-1">
                    <ResourceLink
                      href="https://ikusi.service-now.com/colombia"
                      title="SERVICENOW"
                      subtitle="Gestión de incidencias y solicitudes (Colombia)"
                      ariaLabel="ServiceNow - Gestión de incidencias y solicitudes Colombia"
                    />
                  </div>

                  <div className="flex-1">
                    <ResourceLink
                      href="https://id.cisco.com/oauth2/default/v1/authorize?response_type=code&scope=openid%20profile%20address%20offline_access%20cci_coimemberOf%20email&client_id=cae-okta-web-gslb-01&state=e73wpl5CQD4G50dLMpSuqGjcpLc&redirect_uri=https%3A%2F%2Fccrc.cisco.com%2Fcb%2Fsso&nonce=pfDuXeO_o1BnKoOUdbwlNkx94k0P2BHYr5_zvC75EXw"
                      title="CISCO CCW"
                      subtitle="Portal Cisco para pedidos y licencias"
                      ariaLabel="CISCO CCW - Portal Cisco para pedidos y licencias"
                    />
                  </div>

                  <div className="mt-auto text-xs text-slate-400 italic">¿Necesitas acceso? Contacta con tu administrador de sistemas.</div>
                </div>
              </div>

              {/* Accesos rápidos */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-50 mb-4">Accesos rápidos</h3>
                <div className="space-y-3 h-full flex flex-col items-center">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full max-w-xs rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-semibold h-12"
                    onClick={() => handleAccess("/")}
                    disabled={isLoading}
                  >
                    Acceso a Finanzas SMO
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="w-full max-w-xs rounded-md bg-slate-800 text-white h-12 border border-slate-700"
                    onClick={() => handlePortalAccess(PMO_PORTAL_LOGIN, { requiresRoleCheck: true })}
                    disabled={isLoading}
                  >
                    Gestor de Actas
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="w-full max-w-xs rounded-md h-12 border-2 border-slate-600 text-slate-50"
                    onClick={() => handlePortalAccess(PREFACTURAS_PORTAL_LOGIN)}
                    disabled={isLoading}
                  >
                    Prefacturas Proveedores
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="w-full max-w-xs rounded-md h-12 text-slate-50"
                    onClick={() => handlePortalAccess("https://extra-hours-ikusi-ui--valencia94.github.app")}
                    disabled={isLoading}
                  >
                    Horas Extras
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    className="w-full max-w-xs rounded-md h-12 text-slate-50"
                    onClick={() => handlePortalAccess("https://centrix.example")}
                    disabled={isLoading}
                  >
                    Centrix
                  </Button>
                </div>
              </div>
            </div>

            {/* Bottom microcopy */}
            <div className="col-span-full mt-8 px-6 pb-8">
              <p className="text-xs text-slate-400 italic text-center">
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

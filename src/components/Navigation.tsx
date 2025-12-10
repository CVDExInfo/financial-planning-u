import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calculator,
  BarChart3,
  LogOut,
  User,
  UserRound,
  BookOpen,
  FolderKanban,
  FileCheck,
  GitPullRequest,
  TrendingUp,
  Layers,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import usePermissions, { type FinanzasRole } from "@/hooks/usePermissions";
import {
  getDefaultRouteForRole,
  getRoleInfo,
  normalizeAppPath,
} from "@/lib/auth";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { logoutWithHostedUI } from "@/config/aws";
import { ES_TEXTS } from "@/lib/i18n/es";

// Navigation visibility summary:
// - PMO section: only visible when the active role is PMO or when browsing a /finanzas/pmo/* route.
// - SDMT section: visible when the role has access to SDMT routes; vendor and PMO users are filtered out via route access checks.

type NavigationStack = "pmo" | "sdmt" | "finanzas";

type NavigationItem = {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isPremium?: boolean;
  stack: NavigationStack;
  startGroup?: boolean;
};

type FinanzasNavItem = {
  id:
    | "forecast"
    | "reconciliation"
    | "changes"
    | "projects"
    | "catalogoCostos"
    | "catalogoRubros"
    | "reglas"
    | "ajustes"
    | "proveedores"
    | "flujoCaja"
    | "escenarios";
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isPremium?: boolean;
  visibleFor: FinanzasRole[];
  startGroup?: boolean;
};

type NavigationSection = {
  label: string;
  key: string;
  stack: NavigationStack;
  items: NavigationItem[];
};

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout, roles, availableRoles, currentRole, setRole } = useAuth();
  const {
    canAccessRoute: roleCanAccessRoute,
    hasPremiumFinanzasFeatures,
    role: finanzasRole,
  } = usePermissions();

  // Prefer availableRoles when present, otherwise fall back to raw roles
  const roleList = useMemo(
    () => (availableRoles && availableRoles.length ? availableRoles : roles),
    [availableRoles, roles],
  );

  const activeRole = useMemo(
    () => currentRole ?? roleList[0] ?? "SDMT",
    [currentRole, roleList],
  );

  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);

  const finzEnabled =
    import.meta.env.VITE_FINZ_ENABLED !== "false" ||
    (typeof window !== "undefined" &&
      window.location.pathname.startsWith("/finanzas"));

  const FINANZAS_NAV_ITEMS: FinanzasNavItem[] = [
    {
      id: "forecast",
      label: ES_TEXTS.nav.forecast,
      path: "/sdmt/cost/forecast",
      icon: TrendingUp,
      visibleFor: ["SDMT", "EXEC_RO"],
      startGroup: true,
    },
    {
      id: "reconciliation",
      label: ES_TEXTS.nav.reconciliation,
      path: "/sdmt/cost/reconciliation",
      icon: FileCheck,
      visibleFor: ["SDMT", "VENDOR", "EXEC_RO"],
    },
    {
      id: "changes",
      label: ES_TEXTS.nav.changes,
      path: "/sdmt/cost/changes",
      icon: GitPullRequest,
      visibleFor: ["SDMT", "EXEC_RO"],
    },
    {
      id: "projects",
      label: ES_TEXTS.nav.portfolio,
      path: "/projects",
      icon: FolderKanban,
      visibleFor: ["SDMT", "PMO", "EXEC_RO"],
    },
    {
      id: "catalogoCostos",
      label: ES_TEXTS.nav.costStructure,
      path: "/sdmt/cost/catalog",
      icon: BookOpen,
      visibleFor: ["SDMT", "PMO", "VENDOR", "EXEC_RO"],
    },
    {
      id: "catalogoRubros",
      label: ES_TEXTS.nav.rubros,
      path: "/catalog/rubros",
      icon: BookOpen,
      visibleFor: ["SDMT", "PMO", "VENDOR", "EXEC_RO"],
    },
    {
      id: "reglas",
      label: ES_TEXTS.nav.rules,
      path: "/rules",
      icon: BookOpen,
      visibleFor: ["SDMT", "PMO", "EXEC_RO"],
    },
    {
      id: "ajustes",
      label: ES_TEXTS.nav.adjustments,
      path: "/adjustments",
      icon: Shield,
      visibleFor: ["SDMT", "EXEC_RO"],
    },
    {
      id: "proveedores",
      label: ES_TEXTS.nav.providers,
      path: "/providers",
      icon: Layers,
      visibleFor: ["SDMT", "EXEC_RO"],
    },
    {
      id: "flujoCaja",
      label: ES_TEXTS.nav.cashflow,
      path: "/cashflow",
      icon: BarChart3,
      visibleFor: ["SDMT", "PMO", "VENDOR", "EXEC_RO"],
      isPremium: true,
    },
    {
      id: "escenarios",
      label: ES_TEXTS.nav.scenarios,
      path: "/scenarios",
      icon: Layers,
      visibleFor: ["SDMT", "PMO", "VENDOR", "EXEC_RO"],
      isPremium: true,
    },
  ];

  const normalizedPath = normalizeAppPath(location.pathname);
  const userDisplayName = user?.name || user?.email || "User";

  // The ordering of these derived flags matters: isFinanzasNavContext depends on
  // isPmoContext. Keep declarations sequenced to avoid temporal dead zone
  // issues in production builds (the minifier previously emitted `k` before it
  // was initialized, causing a ReferenceError).
  const isPmoContext =
    activeRole === "PMO" ||
    location.pathname.startsWith("/finanzas/pmo/") ||
    normalizedPath.startsWith("/pmo/");

  const finanzasNavNormalizedPaths = FINANZAS_NAV_ITEMS.map((item) =>
    normalizeAppPath(item.path),
  );

  const isFinanzasNavContext =
    finzEnabled &&
    !isPmoContext &&
    (normalizedPath === "/" ||
      finanzasNavNormalizedPaths.some(
        (path) =>
          normalizedPath === path || normalizedPath.startsWith(`${path}/`),
      ));

  // Route guard: if current path is not allowed for the active role, redirect
  // Skip this in Finanzas-only mode to avoid fighting the /finanzas/* SPA routing
  useEffect(() => {
    const isFinanzasOnly = finzEnabled;
    if (isFinanzasOnly) return;

    if (!roleCanAccessRoute(normalizedPath)) {
      const defaultRoute = getDefaultRouteForRole(activeRole);
      navigate(defaultRoute);

      toast.info("Redirected to accessible page", {
        description:
          "You were redirected to a page accessible with your current role",
      });
    }
  }, [activeRole, finzEnabled, navigate, normalizedPath, roleCanAccessRoute]);

  const handleSignOut = () => {
    logout();
    logoutWithHostedUI();
  };

  const navSections: NavigationSection[] = [
    {
      label: "PMO",
      key: "PMO",
      stack: "pmo",
      items: [
        {
          path: "/pmo/prefactura/estimator",
          label: "Estimator",
          icon: Calculator,
          stack: "pmo",
        },
      ],
    },
    {
      label: "SDMT Costos",
      key: "SDMT",
      stack: "sdmt",
      items: [
        {
          path: "/sdmt/cost/catalog",
          label: ES_TEXTS.nav.costStructure,
          icon: BookOpen,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/forecast",
          label: ES_TEXTS.nav.forecast,
          icon: TrendingUp,
          stack: "sdmt",
          startGroup: true,
        },
        {
          path: "/sdmt/cost/reconciliation",
          label: ES_TEXTS.nav.reconciliation,
          icon: FileCheck,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/cashflow",
          label: ES_TEXTS.nav.cashflow,
          icon: BarChart3,
          isPremium: true,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/scenarios",
          label: ES_TEXTS.nav.scenarios,
          icon: Layers,
          isPremium: true,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/changes",
          label: ES_TEXTS.nav.changes,
          icon: GitPullRequest,
          stack: "sdmt",
        },
      ],
    },
    {
      label: "Finanzas",
      key: "FINZ",
      stack: "finanzas",
      items: FINANZAS_NAV_ITEMS.map((item) => ({
        path: item.path,
        label: item.label,
        icon: item.icon,
        isPremium: item.isPremium,
        stack: "finanzas" as const,
        startGroup: item.startGroup,
      })),
    },
  ];

  const allowedStacks: NavigationStack[] = finzEnabled
    ? ["finanzas", "sdmt", "pmo"]
    : ["sdmt", "pmo"];

  const filterNavItem = (item: NavigationItem) => {
    const normalizedItemPath = normalizeAppPath(item.path);

    if (!allowedStacks.includes(item.stack)) return false;
    if (item.stack === "pmo" && !isPmoContext) return false;
    if (item.isPremium && !hasPremiumFinanzasFeatures) return false;
    return roleCanAccessRoute(normalizedItemPath);
  };

  const finanzasNavRole = finanzasRole ?? (activeRole as FinanzasRole | undefined);

  const filteredFinanzasNavItems = FINANZAS_NAV_ITEMS.filter((item) => {
    if (!finanzasNavRole) return false;
    if (!item.visibleFor.includes(finanzasNavRole)) return false;
    if (item.isPremium && !hasPremiumFinanzasFeatures) return false;

    const normalizedItemPath = normalizeAppPath(item.path);
    return roleCanAccessRoute(normalizedItemPath);
  });

  const filteredSections = navSections
    .filter((section) => {
      if (!allowedStacks.includes(section.stack)) return false;

      if (section.stack === "pmo" && !isPmoContext) return false;

      return true;
    })
    .map((section) => ({
      ...section,
      items: section.items.filter(filterNavItem),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      <nav className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-3">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2 lg:gap-3 shrink-0">
              <Logo className="h-7 w-auto lg:h-8" />
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-sm font-semibold text-foreground">Planning</span>
                <span className="text-[11px] font-medium tracking-wide text-emerald-700">
                  Finanzas SD
                </span>
              </div>
            </Link>

            {/* Module Navigation */}
            <TooltipProvider>
              <div className="flex-1 overflow-x-auto">
                <div className="flex items-center gap-2 min-w-fit">
                  {isFinanzasNavContext
                    ? filteredFinanzasNavItems.map((item) => {
                        const normalizedItemPath = normalizeAppPath(item.path);
                        const isActive = normalizedPath === normalizedItemPath;
                        const isPremium = item.isPremium;
                        const clusterClass = item.startGroup
                          ? "relative pl-4 before:absolute before:-left-2 before:top-1/2 before:h-4 before:-translate-y-1/2 before:border-l before:border-border/50"
                          : "";

                        const linkElement = (
                          <Link
                            key={item.id}
                            to={normalizedItemPath}
                            className={`
                              inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
                              ${
                                isActive
                                  ? isPremium
                                    ? "border-border bg-muted text-muted-foreground"
                                    : "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : isPremium
                                  ? "border-dashed border-border text-muted-foreground/80 hover:bg-muted/50"
                                  : "border-transparent text-muted-foreground hover:bg-muted"
                              }
                              ${clusterClass}
                            `}
                          >
                            <item.icon size={16} className={isPremium ? "opacity-70" : ""} />
                            <span className={isPremium ? "opacity-70" : ""}>{item.label}</span>
                            {isPremium && (
                              <Badge
                                variant="outline"
                                className="ml-0.5 h-4 px-1 text-[10px] text-muted-foreground/80"
                              >
                                +
                              </Badge>
                            )}
                          </Link>
                        );

                        if (isPremium) {
                          return (
                            <Tooltip key={item.id}>
                              <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Módulo premium</p>
                                <p className="text-xs text-muted-foreground">
                                  Disponible con permisos extendidos
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        }

                        return linkElement;
                      })
                    : filteredSections.map((section) => (
                        <div
                          key={section.key}
                          className="flex items-center gap-1 pl-2 border-l border-border/50"
                        >
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mr-1">
                            {section.label}
                          </span>
                          {section.items.map((item) => {
                            const Icon = item.icon;
                            const normalizedItemPath = normalizeAppPath(item.path);
                            const isActive = normalizedPath === normalizedItemPath;
                            const isPremium = item.isPremium;
                            const clusterClass = item.startGroup
                              ? "relative pl-4 before:absolute before:-left-2 before:top-1/2 before:h-4 before:-translate-y-1/2 before:border-l before:border-border/50"
                              : "";

                            const linkElement = (
                              <Link
                                key={item.path}
                                to={normalizedItemPath}
                                className={`
                                  inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap
                                  ${
                                    isActive
                                      ? isPremium
                                        ? "border-border bg-muted text-muted-foreground"
                                        : "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : isPremium
                                      ? "border-dashed border-border text-muted-foreground/80 hover:bg-muted/50"
                                      : "border-transparent text-muted-foreground hover:bg-muted"
                                  }
                                  ${clusterClass}
                                `}
                              >
                                <Icon size={16} className={isPremium ? "opacity-70" : ""} />
                                <span className={isPremium ? "opacity-70" : ""}>{item.label}</span>
                                {isPremium && (
                                  <Badge
                                    variant="outline"
                                    className="ml-0.5 h-4 px-1 text-[10px] text-muted-foreground/80"
                                  >
                                    +
                                  </Badge>
                                )}
                              </Link>
                            );

                            if (isPremium) {
                              return (
                                <Tooltip key={item.path}>
                                  <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">Premium Add-on Feature</p>
                                    <p className="text-xs text-muted-foreground">
                                      Additional cost applies
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }

                            return linkElement;
                          })}
                        </div>
                      ))}
                </div>
              </div>
            </TooltipProvider>

            {/* User Menu */}
            <div className="flex items-center gap-3 shrink-0">
              {activeRole && <Badge variant="secondary">{activeRole}</Badge>}

              {user && (
                <TooltipProvider>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            className="h-11 px-3 flex items-center gap-3 border-border shadow-sm"
                          >
                            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">
                              <UserRound className="h-5 w-5" aria-hidden="true" />
                              <span className="sr-only">Menú de usuario</span>
                            </div>
                            <div className="hidden sm:flex flex-col items-start leading-tight">
                              <span className="text-[11px] text-muted-foreground">Cuenta</span>
                              <span className="text-sm font-semibold text-foreground line-clamp-1 max-w-[160px]">
                                {userDisplayName}
                              </span>
                            </div>
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Cuenta / Cerrar sesión</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent className="w-64" align="end">
                      <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                        Sesión
                      </DropdownMenuLabel>
                      <div className="flex items-center justify-start gap-2 px-2 pb-1">
                        <div className="flex flex-col space-y-1 leading-none">
                          <p className="font-medium">{userDisplayName}</p>
                          <p className="w-[220px] truncate text-sm text-muted-foreground">
                            {user.email ?? "user@ikusi.com"}
                          </p>
                        </div>
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => navigate("/profile")}>
                        <div className="flex items-center w-full">
                          <User className="mr-2 h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">Perfil</div>
                            <div className="text-xs text-muted-foreground">
                              Detalles de la cuenta
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
                        Roles
                      </DropdownMenuLabel>
                      {roleList.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onSelect={(event) => {
                            event.preventDefault();
                            if (role === activeRole) return;
                            setRole(role);
                            navigate(getDefaultRouteForRole(role));
                          }}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <span>{role}</span>
                          </div>
                          {role === activeRole ? (
                            <Badge variant="secondary" className="text-[11px]">
                              Activo
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[11px]">
                              Cambiar
                            </Badge>
                          )}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuItem onSelect={() => setIsRolesDialogOpen(true)}>
                        <div className="flex items-center w-full">
                          <Shield className="mr-2 h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">Ver permisos</div>
                            <div className="text-xs text-muted-foreground">
                              {roleList.length} rol{roleList.length !== 1 ? "es" : ""} disponibles
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleSignOut}
                        className="text-destructive"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Roles Dialog – clickable roles to switch context */}
      <Dialog open={isRolesDialogOpen} onOpenChange={setIsRolesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Roles & Permissions</DialogTitle>
            <DialogDescription>
              These roles come from your Cognito groups and determine which PMO
              and Finanzas modules you can access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {roleList.map((role) => {
              const info = getRoleInfo(role);
              const isCurrent = activeRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    if (isCurrent) return;
                    setRole(role);
                    navigate(getDefaultRouteForRole(role));
                    setIsRolesDialogOpen(false);
                  }}
                  className={`w-full text-left border rounded-lg p-3 transition-colors hover:border-primary/50 ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Level {info.level}
                      </p>
                    </div>
                    <Badge variant={isCurrent ? "default" : "secondary"}>
                      {role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {info.description}
                  </p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Navigation;

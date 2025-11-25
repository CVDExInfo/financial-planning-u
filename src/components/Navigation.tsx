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
import usePermissions from "@/hooks/usePermissions";
import {
  getDefaultRouteForRole,
  getRoleInfo,
  normalizeAppPath,
} from "@/lib/auth";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { logoutWithHostedUI } from "@/config/aws";

// Navigation visibility summary:
// - PMO section: only visible when the active role is PMO or when browsing a /finanzas/pmo/* route.
// - SDMT section: visible when the role has access to SDMT routes; vendor and PMO users are filtered out via route access checks.

type NavigationStack = "pmo" | "sdmt" | "finanzas";

interface NavigationItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isPremium?: boolean;
  stack: NavigationStack;
}

interface NavigationSection {
  label: string;
  key: string;
  stack: NavigationStack;
  items: NavigationItem[];
}

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const { user, logout, roles, availableRoles, currentRole, setRole } = useAuth();
  const { canAccessRoute: roleCanAccessRoute, hasPremiumFinanzasFeatures } =
    usePermissions();

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

  const finanzasCombinedNavItems: NavigationItem[] = [
    {
      path: "/projects",
      label: "Proyectos",
      icon: FolderKanban,
      stack: "finanzas",
    },
    {
      path: "/catalog/rubros",
      label: "Catálogo de Rubros",
      icon: BookOpen,
      stack: "finanzas",
    },
    {
      path: "/rules",
      label: "Reglas",
      icon: BookOpen,
      stack: "finanzas",
    },
    {
      path: "/adjustments",
      label: "Ajustes",
      icon: Shield,
      stack: "finanzas",
    },
    {
      path: "/finanzas/sdmt/cost/catalog",
      label: "Catálogo de Costos",
      icon: BookOpen,
      stack: "sdmt",
    },
    {
      path: "/cashflow",
      label: "Flujo de Caja",
      icon: BarChart3,
      stack: "finanzas",
    },
    {
      path: "/scenarios",
      label: "Escenarios",
      icon: Layers,
      stack: "finanzas",
    },
    {
      path: "/providers",
      label: "Proveedores",
      icon: Layers,
      stack: "finanzas",
    },
  ];

  const normalizedPath = normalizeAppPath(location.pathname);
  const userDisplayName = user?.name || user?.email || "User";

  const finanzasNavNormalizedPaths = finanzasCombinedNavItems.map((item) =>
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

  const isPmoContext =
    activeRole === "PMO" ||
    location.pathname.startsWith("/finanzas/pmo/") ||
    normalizedPath.startsWith("/pmo/");

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
          path: "/finanzas/sdmt/cost/catalog",
          label: "Cost Catalog",
          icon: BookOpen,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/forecast",
          label: "Forecast",
          icon: TrendingUp,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/reconciliation",
          label: "Reconciliation",
          icon: FileCheck,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/changes",
          label: "Changes",
          icon: GitPullRequest,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/cashflow",
          label: "Cash Flow",
          icon: BarChart3,
          isPremium: true,
          stack: "sdmt",
        },
        {
          path: "/sdmt/cost/scenarios",
          label: "Scenarios",
          icon: Layers,
          isPremium: true,
          stack: "sdmt",
        },
      ],
    },
    {
      label: "Finanzas",
      key: "FINZ",
      stack: "finanzas",
      items: [
        {
          path: "/catalog/rubros",
          label: "Catálogo de Rubros",
          icon: BookOpen,
          stack: "finanzas",
        },
        {
          path: "/projects",
          label: "Proyectos",
          icon: FolderKanban,
          stack: "finanzas",
        },
        { path: "/rules", label: "Reglas", icon: BookOpen, stack: "finanzas" },
        {
          path: "/adjustments",
          label: "Ajustes",
          icon: Shield,
          stack: "finanzas",
        },
        {
          path: "/cashflow",
          label: "Flujo de Caja",
          icon: BarChart3,
          stack: "finanzas",
        },
        {
          path: "/scenarios",
          label: "Escenarios",
          icon: Layers,
          stack: "finanzas",
        },
        {
          path: "/providers",
          label: "Proveedores",
          icon: Layers,
          stack: "finanzas",
        },
      ],
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

  const filteredFinanzasNavItems = finanzasCombinedNavItems.filter(filterNavItem);

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
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <div className="flex items-center space-x-4">
              <Link to="/" className="flex items-center space-x-3">
                <Logo className="h-8 w-auto" />
                <div>
                  <h1 className="font-semibold text-foreground">
                    Planning
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Finanzas SD
                  </p>
                </div>
              </Link>
            </div>

            {/* Module Navigation */}
            <TooltipProvider>
              <div className="hidden md:flex items-center space-x-1">
                {isFinanzasNavContext
                  ? filteredFinanzasNavItems.map((item) => {
                      const Icon = item.icon;
                      const normalizedItemPath = normalizeAppPath(item.path);
                      const isActive = normalizedPath === normalizedItemPath;
                      const isPremium = item.isPremium;

                      const linkElement = (
                        <Link
                          key={item.path}
                          to={normalizedItemPath}
                          className={`
                            flex items-center space-x-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors relative
                            ${
                              isActive
                                ? isPremium
                                  ? "bg-muted text-muted-foreground border border-border"
                                  : "bg-primary text-primary-foreground"
                                : isPremium
                                ? "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50 border border-dashed border-border"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }
                          `}
                        >
                          <Icon size={16} className={isPremium ? "opacity-70" : ""} />
                          <span className={isPremium ? "opacity-70" : ""}>
                            {item.label}
                          </span>
                          {isPremium && (
                            <Badge
                              variant="outline"
                              className="ml-1 text-xs px-1 py-0 h-4 text-muted-foreground/60 border-muted-foreground/30"
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
                    })
                  : filteredSections.map((section) => (
                      <div
                        key={section.key}
                        className="flex items-center space-x-1 pl-2 border-l border-border/50"
                      >
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mr-1">
                          {section.label}
                        </span>
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          const normalizedItemPath = normalizeAppPath(item.path);
                          const isActive = normalizedPath === normalizedItemPath;
                          const isPremium = item.isPremium;

                          const linkElement = (
                            <Link
                              key={item.path}
                              to={normalizedItemPath}
                              className={`
                                flex items-center space-x-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors relative
                                ${
                                  isActive
                                    ? isPremium
                                      ? "bg-muted text-muted-foreground border border-border"
                                      : "bg-primary text-primary-foreground"
                                    : isPremium
                                    ? "text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/50 border border-dashed border-border"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }
                              `}
                            >
                              <Icon
                                size={16}
                                className={isPremium ? "opacity-70" : ""}
                              />
                              <span className={isPremium ? "opacity-70" : ""}>
                                {item.label}
                              </span>
                              {isPremium && (
                                <Badge
                                  variant="outline"
                                  className="ml-1 text-xs px-1 py-0 h-4 text-muted-foreground/60 border-muted-foreground/30"
                                >
                                  +
                                </Badge>
                              )}
                            </Link>
                          );

                          if (isPremium) {
                            return (
                              <Tooltip key={item.path}>
                                <TooltipTrigger asChild>
                                  {linkElement}
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-medium">
                                    Premium Add-on Feature
                                  </p>
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
            </TooltipProvider>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              {activeRole && (
                <Badge variant="secondary">{activeRole}</Badge>
              )}

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

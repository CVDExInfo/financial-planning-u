import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
  BookOpen,
  FolderKanban,
  FileCheck,
  GitPullRequest,
  TrendingUp,
  Layers,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  getDefaultRouteForRole,
  getRoleInfo,
  canAccessFinanzasModule,
  canAccessPMOModule,
  canAccessRoute,
} from "@/lib/auth";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { logoutWithHostedUI } from "@/config/aws";

// (No props currently)

interface NavigationItem {
  path: string;
  label: string;
  // Icon is a React component (lucide-react exports FC accepting size prop)
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isPremium?: boolean;
}

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, roles } = useAuth();
  const currentRole = useMemo(() => roles[0] ?? "SDMT", [roles]);
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const finzEnabled =
    import.meta.env.VITE_FINZ_ENABLED !== "false" ||
    (typeof window !== "undefined" &&
      window.location.pathname.startsWith("/finanzas"));

  // Check if current route is accessible when role or location changes
  // Skip redirects when in Finanzas-only mode (VITE_FINZ_ENABLED=true)
  useEffect(() => {
    const isFinanzasOnly = finzEnabled;

    // In Finanzas-only mode, keep all Finanzas routes accessible
    if (isFinanzasOnly) {
      return; // No redirects in Finanzas mode
    }

    if (!canAccessRoute(location.pathname, currentRole)) {
      // Redirect to appropriate module based on role
      const defaultRoute = getDefaultRouteForRole(currentRole);
      navigate(defaultRoute);

      toast.info("Redirected to accessible page", {
        description:
          "You were redirected to a page accessible with your current role",
      });
    }
  }, [currentRole, location.pathname, navigate, canAccessRoute]);

  const handleSignOut = () => {
    logout();
    logoutWithHostedUI();
  };

  const moduleNavItems: Record<string, NavigationItem[]> = {
    PMO: [
      {
        path: "/pmo/prefactura/estimator",
        label: "Estimator",
        icon: Calculator,
      },
    ],
    SDMT: [
      { path: "/sdmt/cost/catalog", label: "Catalog", icon: BookOpen },
      { path: "/sdmt/cost/forecast", label: "Forecast", icon: TrendingUp },
      {
        path: "/sdmt/cost/reconciliation",
        label: "Reconciliation",
        icon: FileCheck,
      },
      { path: "/sdmt/cost/changes", label: "Changes", icon: GitPullRequest },
      {
        path: "/sdmt/cost/cashflow",
        label: "Cash Flow",
        icon: BarChart3,
        isPremium: true,
      },
      {
        path: "/sdmt/cost/scenarios",
        label: "Scenarios",
        icon: Layers,
        isPremium: true,
      },
    ],
    FINZ:
      finzEnabled
        ? [
            { path: "/projects", label: "Proyectos", icon: FolderKanban },
            {
              path: "/catalog/rubros",
              label: "Catálogo de Rubros",
              icon: BookOpen,
            },
            { path: "/rules", label: "Rules", icon: BookOpen },
          ]
        : [],
  };

  const getVisibleModuleNavItems = () => {
    const path = location.pathname;
    const userRoles = roles;

    // Check module access based on Cognito groups or Finanzas-only build
    const hasFinanzasAccess = finzEnabled || canAccessFinanzasModule(userRoles);
    const hasPMOAccess = canAccessPMOModule(userRoles);

    // Direct module path detection
    if (path.startsWith("/pmo/") && canAccessRoute(path) && hasPMOAccess)
      return moduleNavItems.PMO;
    if (path.startsWith("/sdmt/") && canAccessRoute(path) && hasFinanzasAccess)
      return moduleNavItems.SDMT;
    // Finanzas routes live at /catalog/* and /rules inside basename /finanzas
    // Also show FINZ nav on home page (/) when Finanzas is the home module
    if (
      (path === "/" ||
        path.startsWith("/catalog/") ||
        path === "/rules" ||
        path.startsWith("/rules/")) &&
      moduleNavItems.FINZ.length &&
      hasFinanzasAccess
    ) {
      return moduleNavItems.FINZ;
    }
    // Fallback to role default set + append FINZ if feature enabled for visibility
    // Only show modules the user has access to based on their Cognito groups
    let items: NavigationItem[] = [];

    if (currentRole === "PMO" && hasPMOAccess) {
      items = [...moduleNavItems.PMO];
    } else if (hasFinanzasAccess) {
      items = [...moduleNavItems.SDMT];
    }

    // Add Finanzas routes if user has access
    if (hasFinanzasAccess) {
      items = [...items, ...moduleNavItems.FINZ];
    }

    return items;
  };

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
                    Financial Planning
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Enterprise PMO Platform
                  </p>
                </div>
              </Link>
            </div>

            {/* Module Navigation */}
            <TooltipProvider>
              <div className="hidden md:flex items-center space-x-1">
                {getVisibleModuleNavItems()
                  ?.filter((item) => canAccessRoute(item.path))
                  .map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    const isPremium = item.isPremium;

                    const linkElement = (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                        flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative
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
                          <TooltipTrigger asChild>{linkElement}</TooltipTrigger>
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
            </TooltipProvider>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <Badge variant="secondary">{currentRole}</Badge>

              {/* User Avatar - Now showing Ikusi Logo */}
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-8 w-8 rounded-full"
                    >
                      <Logo className="h-6 w-auto rounded-full" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium">{user.name || user.email || "User"}</p>
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {user.email ?? "user@ikusi.com"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => navigate("/profile")}>
                      <div className="flex items-center w-full">
                        <User className="mr-2 h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium">Profile</div>
                          <div className="text-xs text-muted-foreground">
                            View account details
                          </div>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setIsRolesDialogOpen(true)}>
                      <div className="flex items-center w-full">
                        <Shield className="mr-2 h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium">Roles & Permissions</div>
                          <div className="text-xs text-muted-foreground">
                            {roles.length} role{roles.length !== 1 ? "s" : ""} available
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
              )}
            </div>
          </div>
        </div>
      </nav>

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
            {roles.map((role) => {
              const info = getRoleInfo(role);
              const isCurrent = currentRole === role;
              return (
                <div
                  key={role}
                  className={`border rounded-lg p-3 ${
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
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default Navigation;

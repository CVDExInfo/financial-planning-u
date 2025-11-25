import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, ArrowRight, Building, FileSpreadsheet } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LoginPage() {
  const { login, isLoading, isAuthenticated, session } = useAuth();
  const sessionEmail =
    isAuthenticated && session.user ? session.user.email ?? session.user.login : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.18),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(139,92,246,0.12),transparent_25%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-900/80" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex items-center gap-3 text-sm font-medium text-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Logo />
          </div>
          Finanzas Ikusi · Portal seguro
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/90 shadow-2xl backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="flex flex-col justify-between gap-6 border-b border-border/40 bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/60 p-8 lg:col-span-3 lg:border-b-0 lg:border-r lg:p-10">
              <div className="space-y-3">
                <CardTitle className="text-3xl font-semibold leading-tight sm:text-4xl">
                  Financial Planning &amp; Service Delivery
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Centraliza presupuestos, conciliaciones SDMT y colaboración con
                  proveedores en un solo módulo para los equipos de Finanzas y PMO.
                </CardDescription>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm">
                  <p className="text-sm font-medium text-foreground">Acceso Ikusi</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Inicia sesión con Cognito Hosted UI y continúa sin fricción en el
                    portal Finanzas.
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/60 p-4 shadow-sm">
                  <p className="text-sm font-medium text-foreground">Flujo unificado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Mantén una experiencia consistente con el diseño Shadcn/Tailwind del
                    resto de la plataforma.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-6 p-8 lg:col-span-2 lg:p-10">
              <div className="space-y-2 text-left lg:text-right">
                <p className="text-sm font-medium text-primary">Entradas rápidas</p>
                <h2 className="text-2xl font-semibold text-foreground">Acceso seguro</h2>
                <p className="text-sm text-muted-foreground">
                  Autentícate para revisar tableros, prefacturas y conciliaciones.
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-background/80 p-4 text-sm text-foreground shadow-sm">
                <p className="font-medium">Inicio de sesión Ikusi</p>
                <p className="mt-1 text-muted-foreground">
                  Te redirigiremos al portal de autenticación de Cognito. Después del
                  ingreso, regresarás automáticamente al módulo Finanzas.
                </p>
                {isAuthenticated && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Sesión activa{sessionEmail ? `: ${sessionEmail}` : ""}. Puedes
                    continuar sin volver a iniciar sesión.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-11 w-full justify-center lg:justify-between"
                  onClick={login}
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    Entrar al portal Finanzas
                  </span>
                  <ArrowRight className="hidden h-4 w-4 lg:inline" aria-hidden="true" />
                </Button>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start gap-2"
                    onClick={() => (window.location.href = "/pmo")}
                  >
                    <Building className="h-4 w-4" aria-hidden="true" />
                    PMO Portal
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start gap-2"
                    onClick={() => (window.location.href = "/pmo/prefactura/estimator")}
                  >
                    <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                    Prefacturas
                  </Button>
                </div>
              </div>

              <p className="text-left text-xs text-muted-foreground lg:text-right">
                Usa tu cuenta corporativa Ikusi. No compartas tus credenciales.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

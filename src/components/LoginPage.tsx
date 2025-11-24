import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LoginPage() {
  const { login, isLoading } = useAuth();

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/50 text-foreground">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex items-center gap-3 text-sm font-medium text-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Logo />
          </div>
          Finanzas · Portal seguro
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-xl backdrop-blur">
          <div className="grid gap-8 lg:grid-cols-5">
            <div className="flex flex-col justify-between gap-6 bg-muted/40 p-8 lg:col-span-3 lg:p-10">
              <div className="space-y-3">
                <CardTitle className="text-3xl font-semibold leading-tight sm:text-4xl">
                  Financial Planning &amp; Service Delivery Portal
                </CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Centraliza presupuestos, control de proveedores y conciliaciones para
                  los equipos de Finanzas y Servicio Profesional.
                </CardDescription>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border/80 bg-background/80 p-4">
                  <p className="text-sm font-medium text-foreground">Acceso unificado</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Inicia sesión con tus credenciales corporativas y conserva el flujo
                    de autenticación de Cognito Hosted UI.
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/80 p-4">
                  <p className="text-sm font-medium text-foreground">Experiencia consistente</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Diseño responsivo alineado al sistema Shadcn/Tailwind ya presente en
                    Finanzas.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-6 p-8 lg:col-span-2 lg:p-10">
              <div className="space-y-2 text-left lg:text-right">
                <p className="text-sm font-medium text-primary">Entrada al módulo</p>
                <h2 className="text-2xl font-semibold text-foreground">Acceso a Finanzas</h2>
                <p className="text-sm text-muted-foreground">
                  Autentícate para revisar tus tableros, asignaciones y procesos de
                  facturación.
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-background/80 p-4 text-sm text-foreground">
                <p className="font-medium">Acceso seguro</p>
                <p className="mt-1 text-muted-foreground">
                  Te redirigiremos al portal de autenticación de Cognito. Después del
                  ingreso, regresarás automáticamente al módulo Finanzas.
                </p>
              </div>

              <Button
                type="button"
                size="lg"
                className="h-11 w-full lg:w-auto"
                onClick={login}
                disabled={isLoading}
              >
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                Ir a la pantalla de inicio de sesión
              </Button>

              <p className="text-left text-xs text-muted-foreground lg:text-right">
                Usa tu cuenta corporativa Ikusi / CVDEx. No compartas tus credenciales.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

export default LoginPage;

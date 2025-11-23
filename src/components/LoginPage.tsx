import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";

export function LoginPage() {
  const { login, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <Card className="border-white/10 bg-white/5 shadow-2xl backdrop-blur">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <Logo />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl text-white">Finanzas Access</CardTitle>
              <CardDescription className="text-slate-200/80">
                Ikusi / CVDEx Secure Sign-in
              </CardDescription>
              <p className="text-sm text-slate-200/70">
                Autentícate con el portal corporativo para continuar.
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100/90">
              <p className="font-medium">Acceso seguro</p>
              <p className="text-slate-200/70 mt-1">
                Serás redirigido al portal de autenticación de Cognito. Después del
                ingreso, volverás automáticamente a Finanzas.
              </p>
            </div>

            <Button
              type="button"
              size="lg"
              className="w-full h-11"
              onClick={login}
              disabled={isLoading}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Ir a la pantalla de inicio de sesión
            </Button>

            <p className="text-center text-xs text-slate-200/70">
              Usa tu cuenta corporativa Ikusi / CVDEx. No compartas tus credenciales.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;

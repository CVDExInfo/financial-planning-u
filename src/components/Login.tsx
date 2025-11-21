import { useState, FormEvent, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { loginWithHostedUI } from "@/config/aws";
import { Logo } from "@/components/Logo";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithCognito } = useAuth();
  const allowPasswordLogin =
    import.meta.env.VITE_ALLOW_PASSWORD_LOGIN === "true" ||
    !import.meta.env.PROD;
  const hostedUIOnly = !allowPasswordLogin;
  // Keep demo credentials disabled in production builds.
  const showDemoCredentials = import.meta.env.VITE_SHOW_DEMO_CREDS === "true";

  useEffect(() => {
    if (hostedUIOnly) {
      setIsLoading(true);
      const timer = setTimeout(() => loginWithHostedUI(), 300);
      return () => clearTimeout(timer);
    }
  }, [hostedUIOnly]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await loginWithCognito(email, password);
      // AuthProvider handles redirect post-login
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setEmail("christian.valencia@ikusi.com");
    setPassword("Velatia@2025");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="glass-card">
          <CardHeader className="text-center space-y-4">
            <div className="mb-6 flex justify-center">
              <Logo />
            </div>
            <div>
              <CardTitle className="text-2xl">
                Financial Planning & Management
              </CardTitle>
              <CardDescription className="text-base mt-2">
                Ikusi Digital Platform - Finanzas
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {hostedUIOnly ? (
              <div className="space-y-4 text-center">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Redirecting to the Cognito Hosted UI for secure sign-in…
                  </AlertDescription>
                </Alert>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loginWithHostedUI()}
                  className="w-full"
                  disabled={isLoading}
                >
                  Continue to Hosted UI
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !email || !password}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            )}

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {!hostedUIOnly && (
              <Button
                type="button"
                variant="outline"
                onClick={() => loginWithHostedUI()}
                className="w-full"
                disabled={isLoading}
              >
                Sign in with Cognito Hosted UI
              </Button>
            )}

            {showDemoCredentials && !hostedUIOnly && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Development Test Credentials (dev use only):
                </p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    <strong>Email:</strong>
                    <br />
                    <code className="bg-background px-2 py-1 rounded">
                      christian.valencia@ikusi.com
                    </code>
                  </p>
                  <p>
                    <strong>Password:</strong>
                    <br />
                    <code className="bg-background px-2 py-1 rounded">
                      Velatia@2025
                    </code>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillDemoCredentials}
                  disabled={isLoading}
                  className="w-full"
                >
                  Autofill Demo Credentials
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          © {new Date().getFullYear()} Ikusi Digital Platform
        </p>
      </div>
    </div>
  );
}

export default Login;

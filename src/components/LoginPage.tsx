import { useState, FormEvent } from "react";
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
import { useAuth } from "@/components/AuthProvider";
import { loginWithHostedUI } from "@/config/aws";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { loginWithCognito } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await loginWithCognito(email, password);
      // On success, AuthProvider redirects to home automatically
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
      setPassword(""); // Clear password on error
    } finally {
      setIsLoading(false);
    }
  };

  // Demo credentials for development
  const fillDemoCredentials = () => {
    setEmail("christian.valencia@ikusi.com");
    setPassword("Velatia@2025");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="glass-card">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">
                  I
                </span>
              </div>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@ikusi.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Sign In Button */}
              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="w-full h-11"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Hosted UI Login Button */}
            <Button
              type="button"
              variant="outline"
              onClick={loginWithHostedUI}
              disabled={isLoading}
              className="w-full"
            >
              Sign in with Cognito Hosted UI
            </Button>

            {/* Demo Credentials (Development) */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Development Test Credentials:
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
                className="w-full text-xs"
              >
                Fill Demo Credentials
              </Button>
            </div>

            {/* Additional Info */}
            <div className="text-center text-xs text-muted-foreground">
              <p>Credentials securely authenticated via Cognito IdP</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default LoginPage;

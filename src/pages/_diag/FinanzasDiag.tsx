import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface HealthCheckResult {
  name: string;
  status: "success" | "error" | "warning" | "loading";
  message: string;
  details?: Record<string, string | number | boolean>;
}

export default function FinanzasDiag() {
  const [checks, setChecks] = useState<HealthCheckResult[]>([
    { name: "Environment Configuration", status: "loading", message: "Checking..." },
    { name: "API Health Endpoint", status: "loading", message: "Checking..." },
    { name: "CORS Preflight", status: "loading", message: "Checking..." },
    { name: "Authentication Status", status: "loading", message: "Checking..." },
  ]);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const results: HealthCheckResult[] = [];

    // Check 1: Environment Configuration
    const viteApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";
    const viteAppBasename = import.meta.env.VITE_APP_BASENAME || "";
    const viteCognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || import.meta.env.VITE_COGNITO_WEB_CLIENT_ID || "";
    const viteCognitoPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || import.meta.env.VITE_COGNITO_POOL_ID || "";
    const viteCognitoRegion = import.meta.env.VITE_COGNITO_REGION || import.meta.env.VITE_AWS_REGION || "";
    const viteFinzEnabled = import.meta.env.VITE_FINZ_ENABLED || "";

    const envCheck: HealthCheckResult = {
      name: "Environment Configuration",
      status: viteApiBaseUrl ? "success" : "error",
      message: viteApiBaseUrl
        ? "Environment variables are configured"
        : "VITE_API_BASE_URL is not set",
      details: {
        "window.location.href": window.location.href,
        "window.location.pathname": window.location.pathname,
        "window.location.origin": window.location.origin,
        "VITE_API_BASE_URL": viteApiBaseUrl || "(not set)",
        "VITE_APP_BASENAME": viteAppBasename || "(not set)",
        "VITE_COGNITO_CLIENT_ID": viteCognitoClientId || "(not set)",
        "VITE_COGNITO_USER_POOL_ID": viteCognitoPoolId || "(not set)",
        "VITE_COGNITO_REGION": viteCognitoRegion || "(not set)",
        "VITE_FINZ_ENABLED": viteFinzEnabled || "(not set)",
      },
    };
    results.push(envCheck);

    // Check 2: API Health Endpoint
    try {
      const apiUrl = viteApiBaseUrl || window.location.origin;
      const healthUrl = `${apiUrl.replace(/\/+$/, "")}/health`;
      
      const healthResponse = await fetch(healthUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "omit",
        mode: "cors",
      });

      if (healthResponse.ok) {
        const healthData = await healthResponse.json().catch(() => ({}));
        results.push({
          name: "API Health Endpoint",
          status: "success",
          message: `API is reachable at ${healthUrl}`,
          details: {
            "HTTP Status": healthResponse.status,
            "Stage": healthData.stage || "(not provided)",
            "Time": healthData.time || "(not provided)",
            "URL": healthUrl,
          },
        });
      } else {
        results.push({
          name: "API Health Endpoint",
          status: "error",
          message: `API returned ${healthResponse.status} ${healthResponse.statusText}`,
          details: {
            "HTTP Status": healthResponse.status,
            "URL": healthUrl,
          },
        });
      }
    } catch (error) {
      results.push({
        name: "API Health Endpoint",
        status: "error",
        message: `Failed to reach API: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          "Error": error instanceof Error ? error.message : String(error),
          "Expected URL": viteApiBaseUrl ? `${viteApiBaseUrl}/health` : "(VITE_API_BASE_URL not set)",
        },
      });
    }

    // Check 3: CORS Preflight
    try {
      const apiUrl = viteApiBaseUrl || window.location.origin;
      const corsUrl = `${apiUrl.replace(/\/+$/, "")}/health`;
      
      const corsResponse = await fetch(corsUrl, {
        method: "OPTIONS",
        headers: {
          "Origin": window.location.origin,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
        mode: "cors",
      });

      const allowOrigin = corsResponse.headers.get("access-control-allow-origin");
      const allowMethods = corsResponse.headers.get("access-control-allow-methods");
      const allowHeaders = corsResponse.headers.get("access-control-allow-headers");

      if (corsResponse.ok || corsResponse.status === 204) {
        results.push({
          name: "CORS Preflight",
          status: allowOrigin ? "success" : "warning",
          message: allowOrigin
            ? "CORS is properly configured"
            : "CORS headers present but Allow-Origin not set",
          details: {
            "HTTP Status": corsResponse.status,
            "Access-Control-Allow-Origin": allowOrigin || "(not set)",
            "Access-Control-Allow-Methods": allowMethods || "(not set)",
            "Access-Control-Allow-Headers": allowHeaders || "(not set)",
            "Request Origin": window.location.origin,
          },
        });
      } else {
        results.push({
          name: "CORS Preflight",
          status: "warning",
          message: `CORS preflight returned ${corsResponse.status}`,
          details: {
            "HTTP Status": corsResponse.status,
            "URL": corsUrl,
          },
        });
      }
    } catch (error) {
      results.push({
        name: "CORS Preflight",
        status: "warning",
        message: `CORS check failed: ${error instanceof Error ? error.message : String(error)}`,
        details: {
          "Error": error instanceof Error ? error.message : String(error),
        },
      });
    }

    // Check 4: Authentication Status
    const tokenPresent = !!localStorage.getItem("finz_jwt");
    results.push({
      name: "Authentication Status",
      status: tokenPresent ? "success" : "warning",
      message: tokenPresent ? "JWT token is present in localStorage" : "No JWT token found",
      details: {
        "Token Present": tokenPresent,
        "Storage Key": "finz_jwt",
        "Cognito Client ID": viteCognitoClientId || "(not configured)",
        "Cognito Pool ID": viteCognitoPoolId || "(not configured)",
      },
    });

    setChecks(results);
  };

  const getStatusIcon = (status: HealthCheckResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "loading":
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
    }
  };

  const getStatusBadge = (status: HealthCheckResult["status"]) => {
    const variants = {
      success: "default" as const,
      error: "destructive" as const,
      warning: "secondary" as const,
      loading: "outline" as const,
    };
    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Finanzas Diagnostics</h1>
        <p className="text-muted-foreground">
          System health checks and environment configuration
        </p>
      </div>

      <div className="grid gap-6">
        {checks.map((check, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <CardTitle className="text-xl">{check.name}</CardTitle>
                </div>
                {getStatusBadge(check.status)}
              </div>
              <CardDescription>{check.message}</CardDescription>
            </CardHeader>
            {check.details && (
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                  <dl className="grid gap-2">
                    {Object.entries(check.details).map(([key, value]) => (
                      <div key={key} className="grid grid-cols-[200px_1fr] gap-4">
                        <dt className="font-semibold text-muted-foreground">{key}:</dt>
                        <dd className="break-all">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              onClick={runDiagnostics}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Re-run Diagnostics
            </button>
            <button
              onClick={() => localStorage.removeItem("finz_jwt")}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
            >
              Clear JWT Token
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <p>
          <strong>Note:</strong> This diagnostic page is for development and debugging purposes only.
          It should not be exposed in production environments.
        </p>
      </div>
    </div>
  );
}

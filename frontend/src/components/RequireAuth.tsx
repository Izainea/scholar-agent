import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  clearBasicAuth,
  getBasicAuthToken,
  setBasicAuthCredentials,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Gate that blocks rendering of `children` until the user has entered
 * a valid (APP_USER, APP_PASSWORD) pair. The credentials are kept in
 * localStorage and automatically attached to every API request.
 *
 * If the backend has `AUTH_ENABLED=false` (no APP_USER / APP_PASSWORD
 * env vars), `/health` reports it and we skip the gate entirely.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<"checking" | "needed" | "ok" | "disabled">(
    "checking",
  );

  // Probe /health to learn whether auth is required AND whether our
  // stored token is still valid.
  const check = async () => {
    try {
      const r = await api.get<{ auth_enabled: boolean }>("/health");
      if (!r.data.auth_enabled) {
        setAuthState("disabled");
        return;
      }
      // Auth is on. Verify our token (if any) by hitting a protected route.
      if (!getBasicAuthToken()) {
        setAuthState("needed");
        return;
      }
      try {
        await api.get("/authors");
        setAuthState("ok");
      } catch (e) {
        // 401 → interceptor already cleared the token.
        if ((e as { response?: { status?: number } })?.response?.status === 401) {
          setAuthState("needed");
        } else {
          // Network / other error — let the user retry from the modal.
          setAuthState("needed");
        }
      }
    } catch {
      // Backend unreachable — show login anyway, the form will surface
      // the network failure when they submit.
      setAuthState("needed");
    }
  };

  useEffect(() => {
    check();
    const onAuthRequired = () => setAuthState("needed");
    window.addEventListener("scholar-agent:auth-required", onAuthRequired);
    return () => window.removeEventListener("scholar-agent:auth-required", onAuthRequired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authState === "checking") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (authState === "needed") {
    return <LoginScreen onSuccess={() => setAuthState("ok")} />;
  }

  return <>{children}</>;
}

interface LoginProps {
  onSuccess: () => void;
}

function LoginScreen({ onSuccess }: LoginProps) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !password) return;
    setSubmitting(true);
    setBasicAuthCredentials(user.trim(), password);
    try {
      await api.get("/authors");
      qc.invalidateQueries();
      toast.success("Sesión iniciada");
      onSuccess();
    } catch (err) {
      clearBasicAuth();
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        toast.error("Usuario o contraseña incorrectos");
      } else {
        toast.error("No se pudo conectar con el servidor");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            <CardTitle>Scholar Agent</CardTitle>
          </div>
          <CardDescription>
            Acceso protegido. Ingresa tus credenciales para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="user">Usuario</Label>
              <Input
                id="user"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoFocus
                disabled={submitting}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!user.trim() || !password || submitting}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

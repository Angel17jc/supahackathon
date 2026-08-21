import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Store, Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, shopName }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo crear la tienda");
      }

      const data = await res.json();

      // Set the session in Supabase client
      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      setSuccess(true);
      setTimeout(() => setLocation("/inventario", { replace: true }), 1500);
    } catch (err: any) {
      setError(err.message || "Error al crear la tienda");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 text-primary mx-auto">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground">Crea tu tienda</h1>
          <p className="text-muted-foreground text-sm">
            Dale un nombre a tu tienda y crea tu cuenta. Después podrás agregar productos.
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-green-500/20 bg-green-500/5 p-8">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
            <p className="font-medium text-green-600">¡Tienda creada!</p>
            <p className="text-sm text-muted-foreground text-center">Redirigiendo a tu panel...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-8 shadow-xl">
            <div className="space-y-1.5">
              <label htmlFor="shopName" className="block text-sm font-medium">Nombre de la tienda</label>
              <Input
                id="shopName"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ej: Mi Tienda de Barrio"
                required
                minLength={2}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Este nombre aparecerá en la vitrina pública.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium">Correo electrónico</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium">Contraseña</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <Button className="w-full" type="submit" disabled={isSubmitting || shopName.trim().length < 2 || !email || password.length < 6}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Store className="mr-2 h-4 w-4" />}
              Crear mi tienda
            </Button>

            <button
              type="button"
              onClick={() => setLocation("/iniciar-sesion")}
              className="w-full text-sm text-primary hover:text-primary/80"
            >
              Ya tengo cuenta — Iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRightLeft, CheckCircle2, Eye, EyeOff, Loader2, PackageSearch, ShieldCheck, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Mode = "login" | "forgot";

const passwordResetPath = "/restablecer-contrasena?reset=1";

const capabilities = [
  {
    icon: PackageSearch,
    title: "Catálogo público",
    description: "Cualquiera navega los productos de las tiendas del barrio sin necesidad de cuenta.",
  },
  {
    icon: ShieldCheck,
    title: "Aislamiento de datos",
    description: "Cada tienda solo ve y gestiona sus propios productos y apartados.",
  },
  {
    icon: ArrowRightLeft,
    title: "Auditoría inmutable",
    description: "Cada acción queda registrada. Ni siquiera la clave de servicio puede borrar el registro.",
  },
];

function getAuthErrorMessage(error: { message: string; status?: number }) {
  const message = error.message.toLowerCase();

  if (message.includes("invalid login") || message.includes("credentials")) {
    return "Correo o contraseña incorrectos.";
  }

  if (message.includes("rate limit") || error.status === 429) {
    return "Demasiados intentos seguidos. Espera unos minutos antes de volver a probar.";
  }

  if (message.includes("smtp") || message.includes("email")) {
    return "No fue posible enviar el correo. Inténtalo de nuevo en unos minutos.";
  }

  return "No fue posible completar la solicitud. Verifica los datos e inténtalo nuevamente.";
}

export default function Login() {
  const [location, setLocation] = useLocation();
  const mode: Mode = location === "/recuperar-acceso" ? "forgot" : "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function changeRoute(path: string) {
    setError(null);
    setMessage(null);
    setLocation(path);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    setIsSubmitting(true);
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${passwordResetPath}` });
    setIsSubmitting(false);

    if (result.error) {
      // The status is enough to diagnose; the message can echo back the input.
      console.error("Authentication request failed", { status: result.error.status });
      setError(getAuthErrorMessage(result.error));
      return;
    }

    if (mode === "login") {
      setLocation("/panel", { replace: true });
      return;
    }

    // Worded so it reveals nothing about which addresses have an account.
    setMessage("Si el correo corresponde a una cuenta, recibirás un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10 lg:py-16">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Store className="h-6 w-6" />
          </span>
          <span className="text-lg font-semibold tracking-tight">ENVY Marketplace</span>
        </div>

        <div className="mt-10 grid items-center gap-12 lg:mt-14 lg:grid-cols-[1.1fr_minmax(380px,1fr)] lg:gap-16">
          {/* On a phone the form comes first: staff sign in several times a day
              and should not scroll past the pitch to reach it. */}
          <section className="space-y-10 lg:order-none">
            <div className="space-y-4">
              <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
                El marketplace de tu barrio, <span className="text-primary">con datos seguros</span>
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                Las tiendas publican su catálogo, los compradores exploran sin sesión, y cada
                tienda solo ve lo suyo. Aislamiento real, no un frontend que esconde botones.
              </p>
            </div>

          <ul className="space-y-5">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted-foreground">
            El acceso lo crea el administrador de la plataforma. Si eres vendedor o comprador, pídeselo a quien gestiona ENVY Marketplace.
          </p>
        </section>

        <section className="order-first w-full lg:order-none lg:max-w-md lg:justify-self-end">
          <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-8 shadow-2xl">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold text-white">
                {mode === "forgot" ? "Recuperar acceso" : "Inicia sesión"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "forgot"
                  ? "Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva."
                  : "Entra con la cuenta que te asignó tu administrador."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium">Correo electrónico</label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@empresa.com"
                required
                autoComplete="email"
              />
            </div>

            {mode === "login" && (
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium">Contraseña</label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {message && (
              <p className="flex gap-2 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0 translate-y-0.5" />
                {message}
              </p>
            )}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Ingresar" : "Enviar enlace de recuperación"}
            </Button>

            {mode === "login" ? (
              <button
                type="button"
                onClick={() => changeRoute("/recuperar-acceso")}
                className="w-full rounded-md py-1 text-sm text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ¿Olvidaste tu contraseña?
              </button>
            ) : (
              <button
                type="button"
                onClick={() => changeRoute("/iniciar-sesion")}
                className="flex w-full items-center justify-center gap-1.5 rounded-md py-1 text-sm text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a iniciar sesión
              </button>
            )}
          </form>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Tu sesión se cierra al cerrar la pestaña y tras 30 minutos sin actividad.
          </p>
          </section>
        </div>
      </div>
    </div>
  );
}

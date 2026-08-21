import { useId, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Check, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { passwordRules } from "@shared/schema";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// The same definitions the API validates against, so the live feedback below
// can never drift from what the server will accept.
const rules = passwordRules;

function PasswordField({
  value,
  onChange,
  label,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoComplete: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  // The toggle cannot live inside the label: its text would be folded into the
  // field's accessible name, which screen readers then announce as
  // "Nueva contraseña Mostrar nueva contraseña".
  const id = useId();

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isVisible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function Requirement({ isMet, children }: { isMet: boolean; children: string }) {
  return (
    <li className={`flex items-center gap-2 transition-colors ${isMet ? "text-green-400" : "text-muted-foreground"}`}>
      {isMet ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 opacity-40" />}
      {children}
    </li>
  );
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { completePasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checks = useMemo(() => rules.map((rule) => rule.isMet(password)), [password]);
  const matches = password.length > 0 && password === confirmation;
  const canSubmit = checks.every(Boolean) && matches && !isSubmitting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setIsSubmitting(true);
    // The API re-validates and applies the change; this request only carries it.
    const response = await authenticatedFetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    setIsSubmitting(false);

    if (!response || !response.ok) {
      if (response?.status === 401) {
        setError("El enlace de recuperación caducó o ya fue utilizado. Solicita uno nuevo.");
        return;
      }
      const body = await response?.json().catch(() => null);
      setError(body?.message ?? "No fue posible guardar la contraseña. Inténtalo nuevamente.");
      return;
    }

    completePasswordRecovery();
    await supabase.auth.signOut();
    setLocation("/iniciar-sesion", { replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <ShieldCheck />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground">Crea una contraseña segura para tu cuenta.</p>
        </div>

        <div className="space-y-4">
          <PasswordField label="Nueva contraseña" value={password} onChange={setPassword} autoComplete="new-password" />
          <PasswordField label="Confirmar contraseña" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
        </div>

        <ul className="space-y-1.5 text-xs" aria-live="polite">
          {rules.map((rule, index) => (
            <Requirement key={rule.label} isMet={checks[index]}>
              {rule.label}
            </Requirement>
          ))}
          <Requirement isMet={matches}>Las dos contraseñas coinciden</Requirement>
        </ul>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <Button className="w-full" type="submit" disabled={!canSubmit}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Guardar nueva contraseña
        </Button>
      </form>
    </main>
  );
}

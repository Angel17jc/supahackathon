import type { NextFunction, Request, Response } from "express";
import { supabase } from "./db.js";

export type AuditOutcome = "allowed" | "denied";

export interface AuditEntryInput {
  actorId?: string | null;
  actorEmail?: string | null;
  organizationId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  outcome: AuditOutcome;
  detail?: Record<string, unknown>;
}

/**
 * Escribe una línea en el registro. Nunca lanza: un fallo al auditar no debe
 * tumbar la operación que se estaba auditando, y menos convertir un 403 en un
 * 500 que le diría al atacante que algo distinto ocurrió.
 */
export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  const { error } = await (supabase as any).from("audit_log").insert({
    actor_id: entry.actorId ?? null,
    actor_email: entry.actorEmail ?? null,
    organization_id: entry.organizationId ?? null,
    action: entry.action,
    resource: entry.resource,
    resource_id: entry.resourceId ?? null,
    outcome: entry.outcome,
    detail: entry.detail ?? {},
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("No se pudo escribir en audit_log:", error.message);
  }
}

const auditedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Deja rastro de dos cosas: toda mutación, y todo rechazo.
 *
 * Los rechazos son la mitad interesante. Un 401 o un 403 significa que alguien
 * pidió algo que no le corresponde, y sin registro esa señal se pierde en el
 * momento en que se devuelve la respuesta. Se registran también los GET cuando
 * terminan en rechazo, precisamente porque leer lo ajeno es el intento que más
 * cuesta detectar después.
 */
export function auditRequests(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;

    const denied = res.statusCode === 401 || res.statusCode === 403;
    const mutation = auditedMethods.has(req.method) && res.statusCode < 400;
    if (!denied && !mutation) return;

    // El cuerpo no se guarda: puede traer notas de compradores y credenciales
    // en el caso del cambio de contraseña. La ruta y el estado bastan para
    // reconstruir qué se intentó.
    void recordAudit({
      actorId: req.user?.id ?? null,
      actorEmail: req.user?.email ?? null,
      organizationId: req.organization?.id ?? null,
      action: `${req.method} ${req.path}`,
      resource: req.path.split("/")[2] ?? "api",
      resourceId: typeof req.params?.id === "string" ? req.params.id : null,
      outcome: denied ? "denied" : "allowed",
      detail: { status: res.statusCode },
    });
  });

  next();
}

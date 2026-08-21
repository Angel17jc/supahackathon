import type { NextFunction, Request, Response } from "express";
import { supabase } from "./db.js";
import type { OrganizationRole } from "../shared/tenancy.js";
export { requireOrganizationRole } from "./authorization.js";

const organizationRoles = ["owner", "manager", "cashier"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface AuthenticatedUser {
  id: string;
  email: string | undefined;
  isPlatformAdmin: boolean;
}

export interface OrganizationContext {
  id: string;
  role: OrganizationRole | "platform_admin";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      organization?: OrganizationContext;
    }
  }
}

function getBearerToken(request: Request): string | undefined {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

function isOrganizationRole(role: unknown): role is OrganizationRole {
  return typeof role === "string" && organizationRoles.includes(role as OrganizationRole);
}

export async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: "Authentication required" });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ message: "Invalid or expired session" });

  // `role: admin` is accepted only during the migration from the legacy release.
  const isPlatformAdmin = user.app_metadata.platform_role === "platform_admin" || user.app_metadata.role === "admin";
  req.user = { id: user.id, email: user.email, isPlatformAdmin };
  return next();
}

export async function requireOrganizationContext(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });

  const organizationId = req.header("x-organization-id");
  if (!organizationId || !uuidPattern.test(organizationId)) {
    return res.status(400).json({ message: "A valid X-Organization-Id header is required" });
  }

  if (req.user.isPlatformAdmin) {
    const { data, error } = await (supabase as any).from("organizations").select("id").eq("id", organizationId).maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ message: "Organization not found" });
    req.organization = { id: organizationId, role: "platform_admin" };
    return next();
  }

  // The organization's own status is read alongside the membership: suspending
  // a tenant has to cut off its API access, and filtering by status in the
  // browser only hides the data from the interface.
  const { data, error } = await (supabase as any)
    .from("organization_memberships")
    .select("role, organization:organizations(status)")
    .eq("organization_id", organizationId)
    .eq("user_id", req.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error) return next(error);
  if (!data || !isOrganizationRole(data.role)) return res.status(403).json({ message: "No access to this organization" });
  if (data.organization?.status !== "active") {
    return res.status(403).json({ message: "This organization is suspended" });
  }

  req.organization = { id: organizationId, role: data.role };
  return next();
}

export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isPlatformAdmin) return res.status(403).json({ message: "Platform administrator permissions required" });
  return next();
}

export async function getAccessibleOrganizations(user: AuthenticatedUser) {
  if (user.isPlatformAdmin) {
    const { data, error } = await (supabase as any).from("organizations").select("id, name, slug, status").order("name");
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await (supabase as any)
    .from("organization_memberships")
    .select("role, organization:organizations(id, name, slug, status)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((membership: any) => ({ ...membership.organization, role: membership.role }));
}

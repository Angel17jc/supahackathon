import { supabase } from "./db.js";

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
}

export interface CreateOrganizationUserInput {
  organizationId: string;
  email: string;
  password: string;
  role: "manager" | "cashier";
}

export interface UpdateOrganizationUserInput {
  organizationId: string;
  userId: string;
  role?: "manager" | "cashier";
  status?: "active" | "disabled";
}

function normalizeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class PlatformService {
  async updateOrganizationStatus(organizationId: string, status: "active" | "suspended") {
    const { data, error } = await (supabase as any).from("organizations").update({ status }).eq("id", organizationId).select("id, name, status").single();
    if (error) throw error;
    return data;
  }

  async resetUserPassword(userId: string, password: string) {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, { password });
    if (error || !data.user) throw error ?? new Error("Could not reset user password");
    return { id: data.user.id, email: data.user.email };
  }

  async createOrganizationWithOwner(input: CreateOrganizationInput) {
    const name = input.name.trim();
    const slug = normalizeSlug(input.slug || name);
    if (!slug) throw new Error("Organization slug is required");

    const { data: organization, error: organizationError } = await (supabase as any)
      .from("organizations")
      .insert({ name, slug, status: "active" })
      .select("id, name, slug, status")
      .single();
    if (organizationError) throw organizationError;

    let userId: string | undefined;
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: input.ownerEmail.trim().toLowerCase(),
        password: input.ownerPassword,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("Could not create owner account");
      userId = data.user.id;

      const { error: membershipError } = await (supabase as any)
        .from("organization_memberships")
        .insert({ organization_id: organization.id, user_id: userId, role: "owner", status: "active" });
      if (membershipError) throw membershipError;

      return { organization, owner: { id: userId, email: data.user.email } };
    } catch (error) {
      // Supabase Auth and the application database cannot share one transaction.
      // Compensate in reverse order to avoid incomplete client accounts.
      if (userId) await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      await (supabase as any).from("organizations").delete().eq("id", organization.id);
      throw error;
    }
  }

  async createOrganizationUser(input: CreateOrganizationUserInput) {
    const { data: organization, error: organizationError } = await (supabase as any)
      .from("organizations")
      .select("id, status")
      .eq("id", input.organizationId)
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization || organization.status !== "active") throw new Error("Organization is not active");

    let userId: string | undefined;
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("Could not create user account");
      userId = data.user.id;

      const { error: membershipError } = await (supabase as any)
        .from("organization_memberships")
        .insert({ organization_id: input.organizationId, user_id: userId, role: input.role, status: "active" });
      if (membershipError) throw membershipError;

      return { id: userId, email: data.user.email, role: input.role };
    } catch (error) {
      if (userId) await supabase.auth.admin.deleteUser(userId).catch(() => undefined);
      throw error;
    }
  }

  async listOrganizationUsers(organizationId: string) {
    const { data: memberships, error } = await (supabase as any)
      .from("organization_memberships")
      .select("user_id, role, status, created_at")
      .eq("organization_id", organizationId)
      .order("created_at");
    if (error) throw error;

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authError) throw authError;
    const usersById = new Map(authData.users.map((user) => [user.id, user]));
    return memberships.map((membership: any) => ({
      id: membership.user_id,
      email: usersById.get(membership.user_id)?.email ?? "Unknown user",
      role: membership.role,
      status: membership.status,
      createdAt: membership.created_at,
    }));
  }

  async updateOrganizationUser(input: UpdateOrganizationUserInput) {
    const { data: membership, error: membershipError } = await (supabase as any)
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership) throw new Error("Organization user not found");
    if (membership.role === "owner") throw new Error("Owner membership cannot be changed from this screen");

    const changes = { ...(input.role ? { role: input.role } : {}), ...(input.status ? { status: input.status } : {}) };
    const { data, error } = await (supabase as any)
      .from("organization_memberships")
      .update(changes)
      .eq("organization_id", input.organizationId)
      .eq("user_id", input.userId)
      .select("user_id, role, status")
      .single();
    if (error) throw error;
    return data;
  }
}

export const platformService = new PlatformService();

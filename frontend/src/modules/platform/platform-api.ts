import { authenticatedFetch } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-errors";

export type OrganizationStaffMember = {
  id: string;
  email: string;
  role: "owner" | "manager" | "cashier";
  status: "active" | "disabled";
};

export type OrganizationUserRole = "manager" | "cashier";

type CreateOrganizationInput = {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
};

type CreateOrganizationUserInput = {
  organizationId: string;
  email: string;
  password: string;
  role: OrganizationUserRole;
};

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) throw new Error(await getApiErrorMessage(response, fallbackMessage));
  return response.json() as Promise<T>;
}

export async function listOrganizationStaff(organizationId: string): Promise<OrganizationStaffMember[]> {
  const response = await authenticatedFetch(`/api/platform/organizations/${organizationId}/users`);
  return parseResponse(response, "No fue posible cargar el personal del cliente.");
}

export async function createOrganization(input: CreateOrganizationInput) {
  const response = await authenticatedFetch("/api/platform/organizations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ organization: { id: string; name: string } }>(response, "No fue posible crear el cliente.");
}

export async function createOrganizationUser(input: CreateOrganizationUserInput) {
  const response = await authenticatedFetch("/api/platform/organization-users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<{ id: string; email: string; role: OrganizationUserRole }>(response, "No fue posible crear el usuario.");
}

export async function updateOrganizationStaffMember(
  userId: string,
  organizationId: string,
  changes: Partial<Pick<OrganizationStaffMember, "role" | "status">>,
) {
  const response = await authenticatedFetch(`/api/platform/organization-users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId, ...changes }),
  });
  return parseResponse(response, "No fue posible actualizar el usuario.");
}

export async function resetOrganizationUserPassword(userId: string, password: string) {
  const response = await authenticatedFetch(`/api/platform/users/${userId}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return parseResponse(response, "No fue posible restablecer la contraseña.");
}

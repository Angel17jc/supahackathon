import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional().default(""),
  ownerEmail: z.string().trim().email().max(255),
  ownerPassword: z.string().min(12).max(128),
});

export const createOrganizationUserSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().trim().email().max(255),
  password: z.string().min(12).max(128),
  role: z.enum(["manager", "cashier"]),
});

export const updateOrganizationUserSchema = z
  .object({
    organizationId: z.string().uuid(),
    role: z.enum(["manager", "cashier"]).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((value) => value.role || value.status, "At least one change is required");

export const updateOrganizationStatusSchema = z.object({
  status: z.enum(["active", "suspended"]),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(12).max(128),
});

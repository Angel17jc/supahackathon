import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrganizationSchema,
  createOrganizationUserSchema,
  resetPasswordSchema,
  updateOrganizationUserSchema,
} from "./platform-schemas.js";

const organizationId = "3a6d6b1c-8519-4be9-990d-f5f6d0eea733";

test("normalizes valid organization creation input", () => {
  const input = createOrganizationSchema.parse({
    name: "  Licorería Central  ",
    ownerEmail: "owner@example.com",
    ownerPassword: "secure-password",
  });

  assert.equal(input.name, "Licorería Central");
  assert.equal(input.slug, "");
});

test("rejects platform users with invalid roles or short passwords", () => {
  assert.throws(() => createOrganizationUserSchema.parse({ organizationId, email: "cashier@example.com", password: "short", role: "owner" }));
  assert.throws(() => resetPasswordSchema.parse({ password: "short" }));
});

test("allows only meaningful staff changes", () => {
  assert.throws(() => updateOrganizationUserSchema.parse({ organizationId }));
  assert.deepEqual(
    updateOrganizationUserSchema.parse({ organizationId, role: "manager", status: "disabled" }),
    { organizationId, role: "manager", status: "disabled" },
  );
});

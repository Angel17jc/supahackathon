import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { requireOrganizationRole } from "./authorization.js";

function createResponse() {
  const result = { statusCode: 200, body: undefined as unknown };
  const response = {
    status(statusCode: number) {
      result.statusCode = statusCode;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
  } as unknown as Response;

  return { response, result };
}

function runRoleGuard(role: "owner" | "manager" | "cashier" | "platform_admin", allowedRoles: Array<"owner" | "manager" | "cashier">) {
  const request = { organization: { id: "3a6d6b1c-8519-4be9-990d-f5f6d0eea733", role } } as Request;
  const { response, result } = createResponse();
  let nextCalled = false;

  requireOrganizationRole(...allowedRoles)(request, response, (() => { nextCalled = true; }) as NextFunction);
  return { nextCalled, result };
}

test("allows owners and managers to use manager operations", () => {
  assert.equal(runRoleGuard("owner", ["owner", "manager"]).nextCalled, true);
  assert.equal(runRoleGuard("manager", ["owner", "manager"]).nextCalled, true);
});

test("denies cashiers from manager operations", () => {
  const { nextCalled, result } = runRoleGuard("cashier", ["owner", "manager"]);
  assert.equal(nextCalled, false);
  assert.deepEqual(result, { statusCode: 403, body: { message: "Insufficient permissions" } });
});

test("allows the platform administrator through organization role guards", () => {
  const { nextCalled } = runRoleGuard("platform_admin", ["owner"]);
  assert.equal(nextCalled, true);
});

test("requires an organization context before role validation", () => {
  const { response, result } = createResponse();
  let nextCalled = false;
  requireOrganizationRole("owner")({} as Request, response, (() => { nextCalled = true; }) as NextFunction);
  assert.equal(nextCalled, false);
  assert.deepEqual(result, { statusCode: 401, body: { message: "Organization context required" } });
});

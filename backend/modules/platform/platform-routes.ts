import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { platformService } from "../../platform-service.js";
import {
  createOrganizationSchema,
  createOrganizationUserSchema,
  resetPasswordSchema,
  updateOrganizationStatusSchema,
  updateOrganizationUserSchema,
} from "./platform-schemas.js";

interface PlatformRouteDependencies {
  requirePlatformAdmin: RequestHandler;
}

export function registerPlatformRoutes(app: Express, { requirePlatformAdmin }: PlatformRouteDependencies) {
  app.post("/api/platform/organizations", requirePlatformAdmin, async (req, res) => {
    const organization = await platformService.createOrganizationWithOwner(createOrganizationSchema.parse(req.body));
    res.status(201).json(organization);
  });

  app.post("/api/platform/organization-users", requirePlatformAdmin, async (req, res) => {
    const user = await platformService.createOrganizationUser(createOrganizationUserSchema.parse(req.body));
    res.status(201).json(user);
  });

  app.get("/api/platform/organizations/:organizationId/users", requirePlatformAdmin, async (req, res) => {
    const organizationId = z.string().uuid().parse(req.params.organizationId);
    res.json(await platformService.listOrganizationUsers(organizationId));
  });

  app.patch("/api/platform/organization-users/:userId", requirePlatformAdmin, async (req, res) => {
    const userId = z.string().uuid().parse(req.params.userId);
    const changes = updateOrganizationUserSchema.parse(req.body);
    res.json(await platformService.updateOrganizationUser({ ...changes, userId }));
  });

  app.patch("/api/platform/organizations/:organizationId/status", requirePlatformAdmin, async (req, res) => {
    const organizationId = z.string().uuid().parse(req.params.organizationId);
    const { status } = updateOrganizationStatusSchema.parse(req.body);
    res.json(await platformService.updateOrganizationStatus(organizationId, status));
  });

  app.post("/api/platform/users/:userId/reset-password", requirePlatformAdmin, async (req, res) => {
    const userId = z.string().uuid().parse(req.params.userId);
    const { password } = resetPasswordSchema.parse(req.body);
    res.json(await platformService.resetUserPassword(userId, password));
  });
}

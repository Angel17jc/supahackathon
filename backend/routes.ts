import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import { supabase } from "./db.js";
import { getAccessibleOrganizations, requireAuthenticatedUser, requireOrganizationContext, requireOrganizationRole, requirePlatformAdmin } from "./auth.js";
import { registerCatalogRoutes } from "./modules/catalog/catalog-routes.js";
import { registerInventoryRoutes } from "./modules/inventory/inventory-routes.js";
import { registerCreditRoutes } from "./modules/credits/credit-routes.js";
import { registerPlatformRoutes } from "./modules/platform/platform-routes.js";
import { api } from "../shared/routes.js";
import { updatePasswordRequestSchema } from "../shared/schema.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/health/database", async (_req, res, next) => {
    const { error } = await supabase
      .from("organizations")
      .select("id", { head: true, count: "exact" })
      .limit(1);

    if (error) return next(error);

    return res.json({ status: "ok", database: "reachable", timestamp: new Date().toISOString() });
  });

  app.use("/api", requireAuthenticatedUser);
  app.get("/api/organizations/me", async (req, res) => {
    res.json(await getAccessibleOrganizations(req.user!));
  });
  // Registered before the organization guard: a user following a recovery link
  // is authenticated but has no reason to carry an organization context yet.
  app.post("/api/account/password", async (req, res, next) => {
    const parsed = updatePasswordRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Contraseña inválida." });
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user!.id, { password: parsed.data.password });
    if (error) return next(error);

    return res.status(204).end();
  });

  registerPlatformRoutes(app, { requirePlatformAdmin });
  app.use("/api", requireOrganizationContext);
  const requireManager = requireOrganizationRole("owner", "manager");
  const requireOperator = requireOrganizationRole("owner", "manager", "cashier");
  const scopedStorage = (req: Express.Request) => storage.forOrganization(req.organization!.id, req.user!.id);

  registerCatalogRoutes(app, { requireManager, scopedStorage });
  registerInventoryRoutes(app, { requireManager, requireOperator, scopedStorage });
  registerCreditRoutes(app, { requireOperator, scopedStorage });

  // Stats
  app.get(api.stats.get.path, async (req, res) => {
    const stats = await scopedStorage(req).getDashboardStats();
    res.json(stats);
  });

  return httpServer;
}

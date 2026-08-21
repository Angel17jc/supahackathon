import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage.js";
import { supabase } from "./db.js";
import { auditRequests } from "./audit.js";
import { getAccessibleOrganizations, requireAuthenticatedUser, requireOrganizationContext, requireOrganizationRole, requirePlatformAdmin } from "./auth.js";
import { registerCatalogRoutes } from "./modules/catalog/catalog-routes.js";
import { registerInventoryRoutes } from "./modules/inventory/inventory-routes.js";
import { registerPlatformRoutes } from "./modules/platform/platform-routes.js";
import { registerMarketplaceRoutes, registerPublicCatalogRoutes } from "./modules/marketplace/marketplace-routes.js";
import { api } from "../shared/routes.js";
import { updatePasswordRequestSchema } from "../shared/schema.js";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Antes de cualquier guardia: toda mutación y todo rechazo dejan rastro,
  // incluidos los que se rechazan por falta de sesión.
  app.use(auditRequests);

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

  // La vitrina se monta antes del guardia de sesión: sin cuenta se navega el
  // catálogo, y la sesión aparece solo cuando alguien quiere apartar algo.
  registerPublicCatalogRoutes(app);

  // Registro de nueva tienda: un usuario crea su cuenta y su tienda en un solo paso.
  app.post("/api/auth/register-shop", async (req, res, next) => {
    try {
      const { email, password, shopName } = req.body;
      if (!email || !password || !shopName) {
        return res.status(400).json({ message: "Correo, contraseña y nombre de tienda son requeridos" });
      }
      if (typeof shopName !== "string" || shopName.trim().length < 2) {
        return res.status(400).json({ message: "El nombre de la tienda debe tener al menos 2 caracteres" });
      }

      const slug = shopName.trim()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

      // Check slug uniqueness
      const { data: existing } = await (supabase as any)
        .from("organizations").select("id").eq("slug", slug).maybeSingle();
      if (existing) {
        return res.status(409).json({ message: "Ya existe una tienda con ese nombre. Prueba con otro." });
      }

      // Create user via admin API (auto-confirms email)
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
      });
      if (authError || !authData.user) {
        const msg = authError?.message?.includes("already")
          ? "Este correo ya está registrado. Inicia sesión."
          : "No se pudo crear la cuenta";
        return res.status(400).json({ message: msg });
      }

      const userId = authData.user.id;

      // Create organization
      const { data: org, error: orgError } = await (supabase as any)
        .from("organizations")
        .insert({ name: shopName.trim(), slug, status: "active" })
        .select("id, name, slug, status")
        .single();
      if (orgError) {
        await supabase.auth.admin.deleteUser(userId);
        throw orgError;
      }

      // Add user as owner
      const { error: membershipError } = await (supabase as any)
        .from("organization_memberships")
        .insert({ organization_id: org.id, user_id: userId, role: "owner", status: "active" });
      if (membershipError) {
        await supabase.auth.admin.deleteUser(userId);
        await (supabase as any).from("organizations").delete().eq("id", org.id);
        throw membershipError;
      }

      // Create profile
      await (supabase as any)
        .from("profiles")
        .upsert({ id: userId, full_name: email.split("@")[0] });

      // Return success — the frontend will sign in with the new credentials.
      return res.status(201).json({
        organization: org,
        email: email.trim().toLowerCase(),
        password,
      });
    } catch (error: any) {
      console.error("register-shop error:", error?.message ?? error);
      next(error);
    }
  });

  // Apartados y auditoría exigen sesión pero no organización. Un comprador no
  // pertenece a ninguna tienda, así que el guardia de contexto lo dejaría fuera
  // de su propia lista de apartados.
  registerMarketplaceRoutes(app, { requireAuthenticatedUser });

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

  // Stats
  app.get(api.stats.get.path, async (req, res) => {
    const stats = await scopedStorage(req).getDashboardStats();
    res.json(stats);
  });

  return httpServer;
}

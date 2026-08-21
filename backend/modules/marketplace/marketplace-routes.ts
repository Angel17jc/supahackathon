import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { supabase } from "../../db.js";
import { recordAudit } from "../../audit.js";
import {
  createReservationRequestSchema,
  updateReservationRequestSchema,
  type CatalogProduct,
  type ReservationWithContext,
} from "../../../shared/schema.js";

// Ninguna consulta de la vitrina pide cost_price. La migración 009 tampoco lo
// concede al navegador, pero estas rutas salen con la clave de servicio, que
// salta cualquier privilegio: aquí la única defensa es no pedirlo.
const CATALOG_COLUMNS =
  "id, name, description, sku, quantity, selling_price, image_url, organization_id, is_published, category:categories(name), shop:organizations(id, name, slug, status)";

function toCatalogProduct(row: any): CatalogProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sku: row.sku,
    quantity: row.quantity,
    sellingPrice: String(row.selling_price),
    imageUrl: row.image_url,
    categoryName: row.category?.name ?? null,
    shopId: row.shop?.id ?? row.organization_id,
    shopName: row.shop?.name ?? "",
    shopSlug: row.shop?.slug ?? "",
  };
}

function toReservation(row: any, shopNames: Map<string, string>, buyerNames: Map<string, string>): ReservationWithContext {
  return {
    id: row.id,
    productId: row.product_id,
    organizationId: row.organization_id,
    buyerId: row.buyer_id,
    quantity: row.quantity,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    productName: row.product?.name ?? "",
    productImageUrl: row.product?.image_url ?? null,
    shopName: shopNames.get(row.organization_id) ?? "",
    buyerName: buyerNames.get(row.buyer_id) ?? null,
  };
}

const RESERVATION_COLUMNS = "*, product:products(name, image_url)";

/**
 * Rellena nombres de tienda y de comprador.
 *
 * reservations.organization_id no tiene clave foránea propia hacia
 * organizations: la integridad la garantiza la compuesta contra products, que
 * ya obliga a que el par (producto, tienda) exista. PostgREST no puede deducir
 * una relación a partir de eso, y buyer_id apunta a auth.users, que queda fuera
 * del esquema público. Dos consultas sueltas cuestan menos que añadir claves
 * redundantes, que es justo lo que rompió los endpoints en la migración 007.
 */
async function hydrateReservations(rows: any[]): Promise<ReservationWithContext[]> {
  if (rows.length === 0) return [];

  const shopIds = Array.from(new Set<string>(rows.map((row) => row.organization_id)));
  const buyerIds = Array.from(new Set<string>(rows.map((row) => row.buyer_id)));

  const [shops, buyers] = await Promise.all([
    (supabase as any).from("organizations").select("id, name").in("id", shopIds),
    (supabase as any).from("profiles").select("id, full_name").in("id", buyerIds),
  ]);

  const shopNames = new Map<string, string>((shops.data ?? []).map((row: any) => [row.id, row.name]));
  const buyerNames = new Map<string, string>((buyers.data ?? []).map((row: any) => [row.id, row.full_name]));

  return rows.map((row) => toReservation(row, shopNames, buyerNames));
}

/**
 * Vitrina pública. Se monta antes del guardia de sesión a propósito: el
 * catálogo tiene que poder leerse sin cuenta, que es justo lo que distingue a un
 * marketplace de un panel de inventario.
 */
export function registerPublicCatalogRoutes(app: Express) {
  app.get("/api/catalog/shops", async (_req, res, next) => {
    const { data, error } = await (supabase as any)
      .from("organizations")
      .select("id, name, slug, products(count)")
      .eq("status", "active")
      .order("name");
    if (error) return next(error);

    return res.json(
      (data ?? []).map((shop: any) => ({
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        productCount: shop.products?.[0]?.count ?? 0,
      })),
    );
  });

  app.get("/api/catalog", async (req, res, next) => {
    let query = (supabase as any).from("products").select(CATALOG_COLUMNS).eq("is_published", true);

    const shop = typeof req.query.shop === "string" ? req.query.shop.trim() : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (shop) query = query.eq("organization_id", shop);
    if (search) query = query.ilike("name", `%${search}%`);

    const { data, error } = await query.order("name");
    if (error) return next(error);
    return res.json((data ?? []).map(toCatalogProduct));
  });

  app.get("/api/catalog/:id", async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ message: "Producto no encontrado" });

    const { data, error } = await (supabase as any)
      .from("products")
      .select(CATALOG_COLUMNS)
      .eq("id", id)
      .eq("is_published", true)
      .maybeSingle();
    if (error) return next(error);
    if (!data) return res.status(404).json({ message: "Producto no encontrado" });
    return res.json(toCatalogProduct(data));
  });
}

interface MarketplaceRouteDependencies {
  requireAuthenticatedUser: RequestHandler;
}

/**
 * Apartados y auditoría. Exigen sesión pero no organización: un comprador no
 * pertenece a ninguna tienda, así que el guardia de contexto de organización lo
 * dejaría fuera de su propia lista.
 */
export function registerMarketplaceRoutes(app: Express, { requireAuthenticatedUser }: MarketplaceRouteDependencies) {
  app.get("/api/reservations", requireAuthenticatedUser, async (req: Request, res: Response, next) => {
    const user = req.user!;

    // Las tiendas del usuario deciden qué ve como vendedor. Sin membresías es
    // comprador, y entonces solo existen las suyas.
    const { data: memberships, error: membershipError } = await (supabase as any)
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (membershipError) return next(membershipError);

    const shopIds = (memberships ?? []).map((row: any) => row.organization_id);
    let query = (supabase as any).from("reservations").select(RESERVATION_COLUMNS);
    if (user.isPlatformAdmin) {
      // Sin filtro.
    } else if (shopIds.length > 0) {
      query = query.or(`buyer_id.eq.${user.id},organization_id.in.(${shopIds.join(",")})`);
    } else {
      query = query.eq("buyer_id", user.id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return next(error);
    return res.json(await hydrateReservations(data ?? []));
  });

  app.post("/api/reservations", requireAuthenticatedUser, async (req: Request, res: Response, next) => {
    const parsed = createReservationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Solicitud inválida" });
    }

    // La tienda se deduce del producto. Aceptarla del cliente permitiría
    // atribuir el apartado a un tercero, y la política de la base lo rechazaría,
    // pero con un error mucho menos claro que este.
    const { data: product, error: productError } = await (supabase as any)
      .from("products")
      .select("id, organization_id, quantity, is_published")
      .eq("id", parsed.data.productId)
      .maybeSingle();
    if (productError) return next(productError);
    if (!product || !product.is_published) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }
    if (product.quantity < parsed.data.quantity) {
      return res.status(400).json({ message: `Solo quedan ${product.quantity} unidades` });
    }

    const { data, error } = await (supabase as any)
      .from("reservations")
      .insert({
        product_id: product.id,
        organization_id: product.organization_id,
        buyer_id: req.user!.id,
        quantity: parsed.data.quantity,
        note: parsed.data.note ?? null,
      })
      .select(RESERVATION_COLUMNS)
      .single();
    if (error) return next(error);

    await recordAudit({
      actorId: req.user!.id,
      actorEmail: req.user!.email,
      organizationId: product.organization_id,
      action: "reservar",
      resource: "reservations",
      resourceId: data.id,
      outcome: "allowed",
      detail: { productId: product.id, quantity: parsed.data.quantity },
    });

    const [hydrated] = await hydrateReservations([data]);
    return res.status(201).json(hydrated);
  });

  app.patch("/api/reservations/:id", requireAuthenticatedUser, async (req: Request, res: Response, next) => {
    const parsed = updateReservationRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Estado inválido" });

    const { data: reservation, error: lookupError } = await (supabase as any)
      .from("reservations")
      .select("id, organization_id, buyer_id")
      .eq("id", req.params.id)
      .maybeSingle();
    if (lookupError) return next(lookupError);
    if (!reservation) return res.status(404).json({ message: "Apartado no encontrado" });

    const isBuyer = reservation.buyer_id === req.user!.id;
    const { data: membership } = await (supabase as any)
      .from("organization_memberships")
      .select("role")
      .eq("organization_id", reservation.organization_id)
      .eq("user_id", req.user!.id)
      .eq("status", "active")
      .maybeSingle();
    const isSeller = Boolean(membership) || req.user!.isPlatformAdmin;

    // El comprador solo retira su solicitud; los demás estados los decide la
    // tienda. La misma regla vive en la política de la base, así que saltarse
    // esta ruta no cambia el resultado.
    const allowed = isSeller || (isBuyer && parsed.data.status === "cancelled");
    if (!allowed) {
      await recordAudit({
        actorId: req.user!.id,
        actorEmail: req.user!.email,
        organizationId: reservation.organization_id,
        action: "cambiar estado de apartado",
        resource: "reservations",
        resourceId: reservation.id,
        outcome: "denied",
        detail: { intento: parsed.data.status },
      });
      return res.status(403).json({ message: "No puedes cambiar el estado de este apartado" });
    }

    const { data, error } = await (supabase as any)
      .from("reservations")
      .update({ status: parsed.data.status })
      .eq("id", reservation.id)
      .select(RESERVATION_COLUMNS)
      .single();
    if (error) return next(error);
    const [hydrated] = await hydrateReservations([data]);
    return res.json(hydrated);
  });

  app.get("/api/audit", requireAuthenticatedUser, async (req: Request, res: Response, next) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { data: memberships } = await (supabase as any)
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", req.user!.id)
      .eq("status", "active");

    const shopIds = (memberships ?? []).map((row: any) => row.organization_id);
    let query = (supabase as any).from("audit_log").select("*");
    if (!req.user!.isPlatformAdmin) {
      query = shopIds.length > 0
        ? query.or(`actor_id.eq.${req.user!.id},organization_id.in.(${shopIds.join(",")})`)
        : query.eq("actor_id", req.user!.id);
    }

    const { data, error } = await query.order("occurred_at", { ascending: false }).limit(limit);
    if (error) return next(error);

    return res.json(
      (data ?? []).map((row: any) => ({
        id: row.id,
        occurredAt: row.occurred_at,
        actorEmail: row.actor_email,
        action: row.action,
        resource: row.resource,
        resourceId: row.resource_id,
        outcome: row.outcome,
        detail: row.detail ?? {},
      })),
    );
  });
}

export const marketplaceSchemas = { createReservationRequestSchema, updateReservationRequestSchema, z };

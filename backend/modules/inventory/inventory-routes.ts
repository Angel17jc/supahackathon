import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { api } from "../../../shared/routes.js";
import { createMovementRequestSchema } from "../../../shared/schema.js";
import { DatabaseStorage } from "../../storage.js";
import { createProductSchema, updateProductSchema } from "./inventory-schemas.js";
import { sendApiError } from "../../errors.js";
import { rejectForeignImage } from "./product-image.js";

type ScopedStorage = (request: Request) => DatabaseStorage;
interface InventoryRouteDependencies { requireManager: RequestHandler; requireOperator: RequestHandler; scopedStorage: ScopedStorage; }

export function registerInventoryRoutes(app: Express, { requireManager, requireOperator, scopedStorage }: InventoryRouteDependencies) {
  app.get(api.products.list.path, async (req, res) => res.json(await scopedStorage(req).getProducts()));
  app.get(api.products.get.path, async (req, res) => { const product = await scopedStorage(req).getProduct(Number(req.params.id)); return product ? res.json(product) : res.status(404).json({ message: "Product not found" }); });

  app.post(api.products.create.path, requireManager, async (req, res) => {
    try {
      const input = createProductSchema.parse(req.body);
      if (input.sku && await scopedStorage(req).getProductBySku(String(input.sku))) return res.status(409).json({ message: "SKU already exists" });
      const rejected = await rejectForeignImage((input as any).imageUrl, {
        organizationId: req.organization!.id, actorId: req.user!.id, actorEmail: req.user!.email,
      });
      if (rejected) return res.status(403).json({ message: rejected });
      return res.status(201).json(await scopedStorage(req).createProduct(input as any));
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message }); throw error; }
  });

  app.put(api.products.update.path, requireManager, async (req, res) => {
    try {
      const input = updateProductSchema.parse(req.body); const productId = Number(req.params.id);
      const existing = input.sku ? await scopedStorage(req).getProductBySku(String(input.sku)) : undefined;
      if (existing && existing.id !== productId) return res.status(409).json({ message: "SKU already exists" });
      const rejected = await rejectForeignImage((input as any).imageUrl, {
        organizationId: req.organization!.id, actorId: req.user!.id, actorEmail: req.user!.email, productId,
      });
      if (rejected) return res.status(403).json({ message: rejected });
      return res.json(await scopedStorage(req).updateProduct(productId, input as any));
    } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message }); throw error; }
  });

  app.delete(api.products.delete.path, requireManager, async (req, res) => { try { await scopedStorage(req).deleteProduct(Number(req.params.id)); return res.status(204).send(); } catch (error) { return sendApiError(res, error); } });
  app.get(api.movements.list.path, async (req, res) => res.json(await scopedStorage(req).getMovements()));
  app.post(api.movements.create.path, requireOperator, async (req, res) => { try { return res.status(201).json(await scopedStorage(req).createMovement(createMovementRequestSchema.parse(req.body))); } catch (error) { if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message }); return sendApiError(res, error); } });
}

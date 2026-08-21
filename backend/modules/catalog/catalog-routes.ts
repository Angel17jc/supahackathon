import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { api } from "../../../shared/routes.js";
import { DatabaseStorage } from "../../storage.js";

type ScopedStorage = (request: Request) => DatabaseStorage;

interface CatalogRouteDependencies {
  requireManager: RequestHandler;
  scopedStorage: ScopedStorage;
}

export function registerCatalogRoutes(app: Express, { requireManager, scopedStorage }: CatalogRouteDependencies) {
  app.get(api.categories.list.path, async (req, res) => {
    res.json(await scopedStorage(req).getCategories());
  });

  app.get(api.categories.get.path, async (req, res) => {
    const category = await scopedStorage(req).getCategory(Number(req.params.id));
    if (!category) return res.status(404).json({ message: "Category not found" });
    return res.json(category);
  });

  app.post(api.categories.create.path, requireManager, async (req, res) => {
    try {
      const category = await scopedStorage(req).createCategory(api.categories.create.input.parse(req.body));
      return res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      throw error;
    }
  });

  app.put(api.categories.update.path, requireManager, async (req, res) => {
    try {
      const category = await scopedStorage(req).updateCategory(Number(req.params.id), api.categories.update.input.parse(req.body));
      return res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      throw error;
    }
  });

  app.delete(api.categories.delete.path, requireManager, async (req, res) => {
    await scopedStorage(req).deleteCategory(Number(req.params.id));
    return res.status(204).send();
  });

  app.get(api.suppliers.list.path, async (req, res) => {
    res.json(await scopedStorage(req).getSuppliers());
  });

  app.get(api.suppliers.get.path, async (req, res) => {
    const supplier = await scopedStorage(req).getSupplier(Number(req.params.id));
    if (!supplier) return res.status(404).json({ message: "Supplier not found" });
    return res.json(supplier);
  });

  app.post(api.suppliers.create.path, requireManager, async (req, res) => {
    try {
      const supplier = await scopedStorage(req).createSupplier(api.suppliers.create.input.parse(req.body));
      return res.status(201).json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      throw error;
    }
  });

  app.put(api.suppliers.update.path, requireManager, async (req, res) => {
    try {
      const supplier = await scopedStorage(req).updateSupplier(Number(req.params.id), api.suppliers.update.input.parse(req.body));
      return res.json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      throw error;
    }
  });

  app.delete(api.suppliers.delete.path, requireManager, async (req, res) => {
    await scopedStorage(req).deleteSupplier(Number(req.params.id));
    return res.status(204).send();
  });
}

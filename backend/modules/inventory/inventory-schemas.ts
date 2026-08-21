import { z } from "zod";
import { api } from "../../../shared/routes.js";

const optionalSkuSchema = z
  .string()
  .trim()
  .max(100)
  .transform((value) => value || null)
  .nullable()
  .optional();

const optionalReferenceIdSchema = z.coerce.number().int().positive().nullable().optional();

const productFields = {
  name: z.string().trim().min(2).max(160),
  sku: optionalSkuSchema,
  description: z.string().trim().max(1_000).nullable().optional(),
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  minStockLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
  costPrice: z.coerce.number().min(0).max(1_000_000),
  sellingPrice: z.coerce.number().min(0).max(1_000_000),
  categoryId: optionalReferenceIdSchema,
  imageUrl: z.string().trim().url().max(2_000).nullable().optional().or(z.literal("").transform(() => null)),
  isPublished: z.boolean().optional(),
};

export const createProductSchema = api.products.create.input.extend(productFields);
export const updateProductSchema = api.products.update.input.extend({
  ...productFields,
  name: productFields.name.optional(),
  quantity: productFields.quantity.optional(),
  costPrice: productFields.costPrice.optional(),
  sellingPrice: productFields.sellingPrice.optional(),
});

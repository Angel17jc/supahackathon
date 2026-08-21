import assert from "node:assert/strict";
import test from "node:test";
import { createProductSchema, updateProductSchema } from "./inventory-schemas.js";

test("normalizes valid product input and an empty SKU", () => {
  const product = createProductSchema.parse({
    name: "  Ron Añejo  ",
    sku: "  ",
    quantity: "12",
    minStockLevel: "3",
    costPrice: "10.50",
    sellingPrice: "16.75",
  });

  assert.equal(product.name, "Ron Añejo");
  assert.equal(product.sku, null);
  assert.equal(product.quantity, 12);
  assert.equal(product.costPrice, 10.5);
});

test("rejects invalid stock, prices, and catalog references", () => {
  const baseProduct = { name: "Vodka", quantity: 1, costPrice: 5, sellingPrice: 8 };
  assert.throws(() => createProductSchema.parse({ ...baseProduct, quantity: -1 }));
  assert.throws(() => createProductSchema.parse({ ...baseProduct, sellingPrice: -1 }));
  assert.throws(() => createProductSchema.parse({ ...baseProduct, categoryId: 0 }));
});

test("allows partial product updates", () => {
  assert.deepEqual(updateProductSchema.parse({ sellingPrice: "18.50" }), { sellingPrice: 18.5 });
  assert.deepEqual(updateProductSchema.parse({}), {});
});

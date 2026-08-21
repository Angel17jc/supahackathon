import assert from "node:assert/strict";
import test from "node:test";
import {
  createCategoryRequestSchema,
  createMovementRequestSchema,
  passwordRules,
  updatePasswordRequestSchema,
} from "./schema.js";

test("accepts a valid stock movement", () => {
  const movement = createMovementRequestSchema.parse({ productId: "7", type: "OUT", quantity: "2", reason: "Venta" });
  assert.deepEqual(movement, { productId: 7, type: "OUT", quantity: 2, reason: "Venta" });
});

test("rejects invalid stock movement quantities and types", () => {
  assert.throws(() => createMovementRequestSchema.parse({ productId: 1, type: "DELETE", quantity: 1 }));
  assert.throws(() => createMovementRequestSchema.parse({ productId: 1, type: "OUT", quantity: 0 }));
});

test("validates category names before they reach the API", () => {
  assert.deepEqual(createCategoryRequestSchema.parse({ name: "  Cervezas  ", description: "  Nacionales  " }), { name: "Cervezas", description: "Nacionales" });
  assert.throws(() => createCategoryRequestSchema.parse({ name: " " }));
});

test("accepts passwords with six characters and a digit or symbol", () => {
  assert.deepEqual(updatePasswordRequestSchema.parse({ password: "abc123" }), { password: "abc123" });
  assert.deepEqual(updatePasswordRequestSchema.parse({ password: "abcde!" }), { password: "abcde!" });
});

test("rejects passwords that are too short or have only letters", () => {
  assert.throws(() => updatePasswordRequestSchema.parse({ password: "abc12" }));
  assert.throws(() => updatePasswordRequestSchema.parse({ password: "abcdefgh" }));
  assert.throws(() => updatePasswordRequestSchema.parse({ password: "a".repeat(129) + "1" }));
});

test("the rules shown in the browser agree with the schema", () => {
  for (const candidate of ["abc123", "abcde!", "abc12", "abcdefgh", ""]) {
    const allRulesMet = passwordRules.every((rule) => rule.isMet(candidate));
    const schemaAccepts = updatePasswordRequestSchema.safeParse({ password: candidate }).success;
    assert.equal(allRulesMet, schemaAccepts, `mismatch for ${JSON.stringify(candidate)}`);
  }
});

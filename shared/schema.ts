import { pgTable, text, serial, integer, timestamp, decimal, varchar, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  contactInfo: text("contact_info"),
  address: text("address"),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  sku: text("sku").unique(),
  quantity: integer("quantity").notNull().default(0),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  imageUrl: text("image_url"),
  minStockLevel: integer("min_stock_level").default(5),
});

export const movements = pgTable("movements", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  productId: integer("product_id").references(() => products.id).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'IN', 'OUT', 'ADJUSTMENT'
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
  userId: varchar("user_id"), // Optional linkage to auth user
});

export const creditAccounts = pgTable("credit_accounts", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  customerName: text("customer_name").notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  movementId: integer("movement_id").references(() => movements.id),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default('0'),
  remainingAmount: decimal("remaining_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'), // 'pending', 'partial', 'paid'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const creditPayments = pgTable("credit_payments", {
  id: serial("id").primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  creditAccountId: integer("credit_account_id").references(() => creditAccounts.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  movements: many(movements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  product: one(products, {
    fields: [movements.productId],
    references: [products.id],
  }),
}));

export const creditAccountsRelations = relations(creditAccounts, ({ one, many }) => ({
  product: one(products, {
    fields: [creditAccounts.productId],
    references: [products.id],
  }),
  movement: one(movements, {
    fields: [creditAccounts.movementId],
    references: [movements.id],
  }),
  payments: many(creditPayments),
}));

export const creditPaymentsRelations = relations(creditPayments, ({ one }) => ({
  creditAccount: one(creditAccounts, {
    fields: [creditPayments.creditAccountId],
    references: [creditAccounts.id],
  }),
}));

// === BASE SCHEMAS ===
// Tenant identity is resolved exclusively on the server from the authenticated request.
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, organizationId: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, organizationId: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, organizationId: true });
export const insertMovementSchema = createInsertSchema(movements).omit({ id: true, organizationId: true, createdAt: true });
export const insertCreditAccountSchema = createInsertSchema(creditAccounts).omit({ id: true, organizationId: true, createdAt: true, updatedAt: true });
export const insertCreditPaymentSchema = createInsertSchema(creditPayments).omit({ id: true, organizationId: true, createdAt: true });

export const createCategoryRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateCategoryRequestSchema = createCategoryRequestSchema.partial();

export const createSupplierRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  contactInfo: z.string().trim().max(255).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
});

export const updateSupplierRequestSchema = createSupplierRequestSchema.partial();

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Category = typeof categories.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Movement = typeof movements.$inferSelect;
export type CreditAccount = typeof creditAccounts.$inferSelect;
export type CreditPayment = typeof creditPayments.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertMovement = z.infer<typeof insertMovementSchema>;
export type InsertCreditAccount = z.infer<typeof insertCreditAccountSchema>;
export type InsertCreditPayment = z.infer<typeof insertCreditPaymentSchema>;

// Extended types for frontend display
export type ProductWithDetails = Product & {
  category?: Category | null;
  supplier?: Supplier | null;
};

export type MovementWithProduct = Movement & {
  product?: Product | null;
};

export type CreditAccountWithDetails = CreditAccount & {
  product?: Product | null;
  payments?: CreditPayment[];
};

// Request types
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>;
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>;

export type CreateProductRequest = InsertProduct;
export type UpdateProductRequest = Partial<InsertProduct>;

export type CreateMovementRequest = InsertMovement;

export const createMovementRequestSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().trim().max(500).nullable().optional(),
});

export const createCreditAccountRequestSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const createCreditPaymentRequestSchema = z.object({
  creditAccountId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive().max(1_000_000).transform((amount) => amount.toFixed(2)),
  paymentMethod: z.string().trim().min(1).max(50).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type CreateCreditAccountRequest = z.infer<typeof createCreditAccountRequestSchema>;
export type CreateCreditPaymentRequest = z.infer<typeof createCreditPaymentRequestSchema>;

// Stats types
export interface DashboardStats {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  recentMovements: MovementWithProduct[];
  weeklyActivity: Array<{ date: string; label: string; inbound: number; outbound: number }>;
}

export interface CreditsStats {
  totalDebt: number;
  totalCustomers: number;
  pendingAccounts: number;
}

// Account password rules. Declared here so the browser can give live feedback
// against the same definition the API enforces; the API is the authority.
export const passwordRules = [
  { label: "Al menos 6 caracteres", isMet: (value: string) => value.length >= 6 },
  { label: "Un número o un carácter especial", isMet: (value: string) => /[\d\W_]/.test(value) },
] as const;

export const accountPasswordSchema = z
  .string()
  .min(6, "La contraseña debe tener al menos 6 caracteres.")
  .max(128, "La contraseña no puede superar los 128 caracteres.")
  .refine((value) => /[\d\W_]/.test(value), "La contraseña debe incluir un número o un carácter especial.");

export const updatePasswordRequestSchema = z.object({
  password: accountPasswordSchema,
});

export type UpdatePasswordRequest = z.infer<typeof updatePasswordRequestSchema>;

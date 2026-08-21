import { pgTable, text, serial, integer, timestamp, decimal, varchar, uuid, boolean, jsonb, bigserial } from "drizzle-orm/pg-core";
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

// Una organización es una tienda del marketplace.
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
  imageUrl: text("image_url"),
  minStockLevel: integer("min_stock_level").default(5),
  isPublished: boolean("is_published").notNull().default(false),
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

// Un comprador no pertenece a ninguna tienda, así que su identidad vive aquí y
// no en organization_memberships.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Cada fila tiene dos dueños legítimos: el comprador que la creó y la tienda
// dueña del producto. Las políticas de la migración 009 son las que impiden que
// la alcance cualquier otro.
export const reservations = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: integer("product_id").notNull(),
  organizationId: uuid("organization_id").notNull(),
  buyerId: uuid("buyer_id").notNull(),
  quantity: integer("quantity").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid("actor_id"),
  actorEmail: text("actor_email"),
  organizationId: uuid("organization_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id"),
  outcome: varchar("outcome", { length: 10 }).notNull(),
  detail: jsonb("detail").notNull().default({}),
});

// === RELATIONS ===
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  movements: many(movements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const movementsRelations = relations(movements, ({ one }) => ({
  product: one(products, {
    fields: [movements.productId],
    references: [products.id],
  }),
}));

export const reservationsRelations = relations(reservations, ({ one }) => ({
  product: one(products, {
    fields: [reservations.productId],
    references: [products.id],
  }),
  shop: one(organizations, {
    fields: [reservations.organizationId],
    references: [organizations.id],
  }),
}));

// === BASE SCHEMAS ===
// Tenant identity is resolved exclusively on the server from the authenticated request.
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, organizationId: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, organizationId: true });
export const insertMovementSchema = createInsertSchema(movements).omit({ id: true, organizationId: true, createdAt: true });

export const createCategoryRequestSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateCategoryRequestSchema = createCategoryRequestSchema.partial();

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type Category = typeof categories.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMembership = typeof organizationMemberships.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Movement = typeof movements.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type InsertMovement = z.infer<typeof insertMovementSchema>;

export type ProductWithDetails = Product & {
  category?: Category | null;
};

export type MovementWithProduct = Movement & {
  product?: Product | null;
};

// Request types
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

export type CreateProductRequest = InsertProduct;
export type UpdateProductRequest = Partial<InsertProduct>;

export type CreateMovementRequest = InsertMovement;

export const createMovementRequestSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().trim().max(500).nullable().optional(),
});

// === MARKETPLACE ===

export const reservationStatuses = ["pending", "confirmed", "rejected", "cancelled"] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];

// La tienda no viaja en la petición. Se deduce del producto en el servidor,
// porque aceptarla del cliente permitiría atribuir un apartado a un tercero.
export const createReservationRequestSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(99),
  note: z.string().trim().max(280).nullable().optional(),
});

export const updateReservationRequestSchema = z.object({
  status: z.enum(reservationStatuses),
});

export type CreateReservationRequest = z.infer<typeof createReservationRequestSchema>;
export type UpdateReservationRequest = z.infer<typeof updateReservationRequestSchema>;

// Lo que ve la vitrina. costPrice no aparece por ninguna parte, igual que el
// privilegio de la migración 009 tampoco lo concede: el tipo y la base dicen lo
// mismo, así que un descuido en el servidor no puede filtrarlo por accidente.
export interface CatalogProduct {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  sellingPrice: string;
  imageUrl: string | null;
  categoryName: string | null;
  shopId: string;
  shopName: string;
  shopSlug: string;
}

export interface ReservationWithContext {
  id: string;
  productId: number;
  organizationId: string;
  buyerId: string;
  quantity: number;
  status: ReservationStatus;
  note: string | null;
  createdAt: string;
  productName: string;
  productImageUrl: string | null;
  shopName: string;
  buyerName: string | null;
}

// Stats types
export interface DashboardStats {
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  recentMovements: MovementWithProduct[];
  weeklyActivity: Array<{ date: string; label: string; inbound: number; outbound: number }>;
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

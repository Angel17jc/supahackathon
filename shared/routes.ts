import { z } from 'zod';
import {
  createCategoryRequestSchema,
  updateCategoryRequestSchema,
  insertProductSchema,
  insertMovementSchema,
  createReservationRequestSchema,
  updateReservationRequestSchema,
  products,
  categories,
  movements
} from './schema.js';
import type { CatalogProduct, ReservationWithContext } from './schema.js';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  categories: {
    list: {
      method: 'GET' as const,
      path: '/api/categories',
      responses: {
        200: z.array(z.custom<typeof categories.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/categories/:id',
      responses: {
        200: z.custom<typeof categories.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/categories',
      input: createCategoryRequestSchema,
      responses: {
        201: z.custom<typeof categories.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/categories/:id',
      input: updateCategoryRequestSchema,
      responses: {
        200: z.custom<typeof categories.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/categories/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect & { category: typeof categories.$inferSelect | null }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id',
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id',
      input: insertProductSchema.partial(),
      responses: {
        200: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  movements: {
    list: {
      method: 'GET' as const,
      path: '/api/movements',
      responses: {
        200: z.array(z.custom<typeof movements.$inferSelect & { product: typeof products.$inferSelect | null }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/movements',
      input: insertMovementSchema,
      responses: {
        201: z.custom<typeof movements.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  catalog: {
    list: {
      method: 'GET' as const,
      path: '/api/catalog',
      responses: {
        200: z.array(z.custom<CatalogProduct>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/catalog/:id',
      responses: {
        200: z.custom<CatalogProduct>(),
        404: errorSchemas.notFound,
      },
    },
    shops: {
      method: 'GET' as const,
      path: '/api/catalog/shops',
      responses: {
        200: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string(), productCount: z.number() })),
      },
    },
  },
  reservations: {
    list: {
      method: 'GET' as const,
      path: '/api/reservations',
      responses: {
        200: z.array(z.custom<ReservationWithContext>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/reservations',
      input: createReservationRequestSchema,
      responses: {
        201: z.custom<ReservationWithContext>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/reservations/:id',
      input: updateReservationRequestSchema,
      responses: {
        200: z.custom<ReservationWithContext>(),
        403: errorSchemas.notFound,
        404: errorSchemas.notFound,
      },
    },
  },
  audit: {
    list: {
      method: 'GET' as const,
      path: '/api/audit',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          occurredAt: z.string(),
          actorEmail: z.string().nullable(),
          action: z.string(),
          resource: z.string(),
          resourceId: z.string().nullable(),
          outcome: z.string(),
          detail: z.record(z.unknown()),
        })),
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalProducts: z.number(),
          totalValue: z.number(),
          lowStockCount: z.number(),
          recentMovements: z.array(z.custom<typeof movements.$inferSelect & { product: typeof products.$inferSelect | null }>()),
          weeklyActivity: z.array(z.object({ date: z.string(), label: z.string(), inbound: z.number(), outbound: z.number() })),
        }),
      },
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// REQUEST/RESPONSE TYPE EXPORTS
// ============================================
export type CreateCategoryRequest = z.infer<typeof api.categories.create.input>;
export type UpdateCategoryRequest = z.infer<typeof api.categories.update.input>;
export type CreateProductRequest = z.infer<typeof api.products.create.input>;
export type UpdateProductRequest = z.infer<typeof api.products.update.input>;
export type CreateMovementRequest = z.infer<typeof api.movements.create.input>;
export type CreateReservationRequest = z.infer<typeof api.reservations.create.input>;
export type UpdateReservationRequest = z.infer<typeof api.reservations.update.input>;

import { z } from 'zod';
import { 
  createCategoryRequestSchema,
  createSupplierRequestSchema,
  updateCategoryRequestSchema,
  updateSupplierRequestSchema,
  insertProductSchema, 
  insertMovementSchema,
  products,
  categories,
  suppliers,
  movements
} from './schema.js';

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
  suppliers: {
    list: {
      method: 'GET' as const,
      path: '/api/suppliers',
      responses: {
        200: z.array(z.custom<typeof suppliers.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/suppliers/:id',
      responses: {
        200: z.custom<typeof suppliers.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/suppliers',
      input: createSupplierRequestSchema,
      responses: {
        201: z.custom<typeof suppliers.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/suppliers/:id',
      input: updateSupplierRequestSchema,
      responses: {
        200: z.custom<typeof suppliers.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/suppliers/:id',
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
        200: z.array(z.custom<typeof products.$inferSelect & { category: typeof categories.$inferSelect | null, supplier: typeof suppliers.$inferSelect | null }>()),
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
export type CreateSupplierRequest = z.infer<typeof api.suppliers.create.input>;
export type UpdateSupplierRequest = z.infer<typeof api.suppliers.update.input>;
export type CreateProductRequest = z.infer<typeof api.products.create.input>;
export type UpdateProductRequest = z.infer<typeof api.products.update.input>;
export type CreateMovementRequest = z.infer<typeof api.movements.create.input>;

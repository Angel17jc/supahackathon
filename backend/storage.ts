import { supabase } from "./db.js";
import type {
  Category, Product, Movement,
  InsertCategory, InsertProduct, InsertMovement,
  UpdateCategoryRequest, UpdateProductRequest,
  DashboardStats,
} from "../shared/schema.js";

// Helper functions to convert between camelCase and snake_case
function toSnakeCase(obj: any): any {
  if (!obj) return obj;
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    result[snakeKey] = value;
  }
  return result;
}

function toCamelCase(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = typeof value === 'object' && value !== null ? toCamelCase(value) : value;
  }
  return result;
}

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: UpdateCategoryRequest): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  
  getProducts(): Promise<(Product & { category: Category | null })[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  
  getMovements(): Promise<(Movement & { product: Product | null })[]>;
  createMovement(movement: InsertMovement): Promise<Movement>;
  
  
  getDashboardStats(): Promise<DashboardStats>;
}

export class DatabaseStorage implements IStorage {
  constructor(private readonly organizationId?: string, private readonly actorId?: string) {}

  forOrganization(organizationId: string, actorId?: string): DatabaseStorage {
    return new DatabaseStorage(organizationId, actorId);
  }

  private get organizationScope(): string {
    if (!this.organizationId) throw new Error("Organization context is required for data access");
    return this.organizationId;
  }

  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase.from('categories').select('*').eq('organization_id', this.organizationScope);
    if (error) throw error;
    return (data || []).map(toCamelCase);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const { data, error } = await supabase.from('categories').select('*').eq('id', id).eq('organization_id', this.organizationScope).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? toCamelCase(data) : undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const { data, error } = await (supabase as any).from('categories').insert({ ...toSnakeCase(category), organization_id: this.organizationScope }).select().single();
    if (error) throw error;
    return toCamelCase(data);
  }

  async updateCategory(id: number, category: UpdateCategoryRequest): Promise<Category> {
    const snakeData = toSnakeCase(category);
    // @ts-expect-error - Supabase types don't support dynamic object conversion
    const { data, error } = await supabase.from('categories').update(snakeData).eq('id', id).eq('organization_id', this.organizationScope).select().single();
    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteCategory(id: number): Promise<void> {
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('organization_id', this.organizationScope);
    if (error) throw error;
  }

  async getProducts(): Promise<(Product & { category: Category | null })[]> {
    const { data, error } = await supabase.from('products').select('*, category:categories(*)').eq('organization_id', this.organizationScope);
    if (error) throw error;
    return (data || []).map(toCamelCase);
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).eq('organization_id', this.organizationScope).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? toCamelCase(data) : undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const { data, error } = await supabase.from('products').select('*').eq('sku', sku).eq('organization_id', this.organizationScope).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? toCamelCase(data) : undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const { data, error } = await (supabase as any).from('products').insert({ ...toSnakeCase(product), organization_id: this.organizationScope }).select().single();
    if (error) throw error;
    return toCamelCase(data);
  }

  async updateProduct(id: number, product: UpdateProductRequest): Promise<Product> {
    const snakeData = toSnakeCase(product);
    // @ts-expect-error - Supabase types don't support dynamic object conversion
    const { data, error } = await supabase.from('products').update(snakeData).eq('id', id).eq('organization_id', this.organizationScope).select().single();
    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteProduct(id: number): Promise<void> {
    const { error } = await supabase.from('products').delete().eq('id', id).eq('organization_id', this.organizationScope);
    if (error) throw error;
  }

  async getMovements(): Promise<(Movement & { product: Product | null })[]> {
    const { data, error } = await supabase.from('movements').select('*, product:products(*)').eq('organization_id', this.organizationScope).order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  }

  async createMovement(movement: InsertMovement): Promise<Movement> {
    const { data, error } = await (supabase as any).rpc('create_inventory_movement', {
      p_organization_id: this.organizationScope,
      p_product_id: movement.productId,
      p_type: movement.type,
      p_quantity: movement.quantity,
      p_reason: movement.reason ?? null,
      p_user_id: this.actorId ?? null,
    });
    if (error) throw error;
    return toCamelCase(data[0]);
  }

  /** @deprecated Replaced by the atomic PostgreSQL function. */
  private async createMovementLegacy(movement: InsertMovement): Promise<Movement> {
    // Verificar stock disponible antes de procesar el movimiento
    const { data: product, error: productError } = await supabase.from('products').select('quantity').eq('id', movement.productId).eq('organization_id', this.organizationScope).single();
    if (productError) throw productError;

    const currentQuantity = (product as any).quantity;
    let newQuantity = currentQuantity;
    
    if (movement.type === 'IN') {
      newQuantity += movement.quantity;
    } else if (movement.type === 'OUT') {
      newQuantity -= movement.quantity;
      // Validar que hay suficiente stock para la salida
      if (newQuantity < 0) {
        throw new Error(`Stock insuficiente. Disponible: ${currentQuantity}, Solicitado: ${movement.quantity}`);
      }
    } else if (movement.type === 'ADJUSTMENT') {
      newQuantity = movement.quantity;
    }

    // Crear el movimiento solo si la validación pasó
    const { data: newMovement, error: movementError } = await (supabase as any).from('movements').insert({ ...toSnakeCase(movement), organization_id: this.organizationScope }).select().single();
    if (movementError) throw movementError;

    // Actualizar la cantidad del producto
    // @ts-expect-error - Supabase types don't infer quantity update correctly
    const { error: updateError } = await supabase.from('products').update({ quantity: newQuantity }).eq('id', movement.productId).eq('organization_id', this.organizationScope);
    if (updateError) throw updateError;

    return toCamelCase(newMovement);
  }

  /** @deprecated Replaced by the atomic PostgreSQL function. */
  /** @deprecated Replaced by the atomic PostgreSQL function. */
  async getDashboardStats(): Promise<DashboardStats> {
    const { count: totalProducts, error: countError } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('organization_id', this.organizationScope);
    if (countError) throw countError;

    const { data: productsData, error: productsError } = await supabase.from('products').select('quantity, cost_price').eq('organization_id', this.organizationScope);
    if (productsError) throw productsError;
    
    const totalValue = (productsData as any[])?.reduce((sum, p) => sum + (p.quantity * parseFloat(p.cost_price || '0')), 0) || 0;

    const { data: allProducts, error: allError } = await supabase.from('products').select('quantity, min_stock_level').eq('organization_id', this.organizationScope);
    if (allError) throw allError;
    
    const lowStockCount = (allProducts as any[])?.filter(p => p.quantity <= (p.min_stock_level || 5)).length || 0;

    const { data: recentMovements, error: movementsError } = await supabase.from('movements').select('*, product:products(*)').eq('organization_id', this.organizationScope).order('created_at', { ascending: false }).limit(5);
    if (movementsError) throw movementsError;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    const { data: activityRows, error: activityError } = await supabase
      .from('movements')
      .select('type, quantity, created_at')
      .eq('organization_id', this.organizationScope)
      .gte('created_at', sevenDaysAgo.toISOString());
    if (activityError) throw activityError;

    const activityByDate = new Map<string, { date: string; label: string; inbound: number; outbound: number }>();
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - offset);
      const date = day.toISOString().slice(0, 10);
      activityByDate.set(date, { date, label: day.toLocaleDateString('es-EC', { weekday: 'short' }), inbound: 0, outbound: 0 });
    }
    for (const movement of (activityRows as any[]) ?? []) {
      const date = movement.created_at?.slice(0, 10);
      const bucket = date ? activityByDate.get(date) : undefined;
      if (!bucket) continue;
      if (movement.type === 'IN') bucket.inbound += movement.quantity;
      if (movement.type === 'OUT') bucket.outbound += movement.quantity;
    }

    return {
      totalProducts: totalProducts || 0,
      totalValue,
      lowStockCount,
      recentMovements: (recentMovements || []).map(toCamelCase),
      weeklyActivity: Array.from(activityByDate.values()),
    };
  }
}

export const storage = new DatabaseStorage();

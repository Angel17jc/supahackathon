import { supabase } from "./db.js";
import type {
  Category, Supplier, Product, Movement, CreditAccount, CreditPayment,
  InsertCategory, InsertSupplier, InsertProduct, InsertMovement, InsertCreditAccount, InsertCreditPayment,
  UpdateCategoryRequest, UpdateSupplierRequest, UpdateProductRequest,
  DashboardStats, CreditAccountWithDetails, CreditsStats, CreateCreditAccountRequest, CreateCreditPaymentRequest
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
  
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier>;
  deleteSupplier(id: number): Promise<void>;
  
  getProducts(): Promise<(Product & { category: Category | null, supplier: Supplier | null })[]>;
  getProduct(id: number): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: UpdateProductRequest): Promise<Product>;
  deleteProduct(id: number): Promise<void>;
  
  getMovements(): Promise<(Movement & { product: Product | null })[]>;
  createMovement(movement: InsertMovement): Promise<Movement>;
  
  getCreditAccounts(): Promise<CreditAccountWithDetails[]>;
  getCreditAccountsByCustomer(customerName: string): Promise<CreditAccountWithDetails[]>;
  getCreditAccount(id: number): Promise<CreditAccountWithDetails | undefined>;
  createCreditAccount(credit: CreateCreditAccountRequest): Promise<CreditAccount>;
  createCreditPayment(payment: CreateCreditPaymentRequest): Promise<CreditPayment>;
  getCreditsStats(): Promise<CreditsStats>;
  
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

  async getSuppliers(): Promise<Supplier[]> {
    const { data, error } = await supabase.from('suppliers').select('*').eq('organization_id', this.organizationScope);
    if (error) throw error;
    return (data || []).map(toCamelCase);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).eq('organization_id', this.organizationScope).single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? toCamelCase(data) : undefined;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const { data, error } = await (supabase as any).from('suppliers').insert({ ...toSnakeCase(supplier), organization_id: this.organizationScope }).select().single();
    if (error) throw error;
    return toCamelCase(data);
  }

  async updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier> {
    const snakeData = toSnakeCase(supplier);
    // @ts-expect-error - Supabase types don't support dynamic object conversion
    const { data, error } = await supabase.from('suppliers').update(snakeData).eq('id', id).eq('organization_id', this.organizationScope).select().single();
    if (error) throw error;
    return toCamelCase(data);
  }

  async deleteSupplier(id: number): Promise<void> {
    const { error } = await supabase.from('suppliers').delete().eq('id', id).eq('organization_id', this.organizationScope);
    if (error) throw error;
  }

  async getProducts(): Promise<(Product & { category: Category | null, supplier: Supplier | null })[]> {
    const { data, error } = await supabase.from('products').select('*, category:categories(*), supplier:suppliers(*)').eq('organization_id', this.organizationScope);
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
    // Buscar cuentas de crédito asociadas al producto
    const { data: accounts, error: accountsError } = await supabase
      .from('credit_accounts')
      .select('id, status')
      .eq('product_id', id)
      .eq('organization_id', this.organizationScope);
    if (accountsError) throw accountsError;

    const accs = (accounts as any[]) || [];
    if (accs.length > 0) {
      // Si existen cuentas no pagadas (pending o partial), bloquear la eliminación
      const blocked = accs.find((a) => a.status !== 'paid');
      if (blocked) {
        throw new Error('No se puede eliminar el producto: existen cuentas de crédito (fiados) pendientes o parciales asociadas');
      }

      // Todas las cuentas están pagadas: procedemos a eliminarlas (esto eliminará también los pagos por ON DELETE CASCADE)
      const ids = accs.map((a) => a.id);
      const { error: delAccError } = await supabase.from('credit_accounts').delete().in('id', ids).eq('organization_id', this.organizationScope);
      if (delAccError) throw delAccError;
    }

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

  async getCreditAccounts(): Promise<CreditAccountWithDetails[]> {
    const { data, error } = await supabase
      .from('credit_accounts')
      .select('*, product:products(*), payments:credit_payments(*)')
      .eq('organization_id', this.organizationScope)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  }

  async getCreditAccountsByCustomer(customerName: string): Promise<CreditAccountWithDetails[]> {
    const { data, error } = await supabase
      .from('credit_accounts')
      .select('*, product:products(*), payments:credit_payments(*)')
      .eq('customer_name', customerName)
      .eq('organization_id', this.organizationScope)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toCamelCase);
  }

  async getCreditAccount(id: number): Promise<CreditAccountWithDetails | undefined> {
    const { data, error } = await supabase
      .from('credit_accounts')
      .select('*, product:products(*), payments:credit_payments(*)')
      .eq('id', id)
      .eq('organization_id', this.organizationScope)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? toCamelCase(data) : undefined;
  }

  async createCreditAccount(credit: CreateCreditAccountRequest): Promise<CreditAccount> {
    const { data, error } = await (supabase as any).rpc('create_credit_sale', {
      p_organization_id: this.organizationScope,
      p_product_id: credit.productId,
      p_customer_name: credit.customerName,
      p_quantity: credit.quantity,
      p_notes: credit.notes ?? null,
      p_user_id: this.actorId ?? null,
    });
    if (error) throw error;
    return toCamelCase(data[0]);
  }

  /** @deprecated Replaced by the atomic PostgreSQL function. */
  private async createCreditAccountLegacy(credit: CreateCreditAccountRequest): Promise<CreditAccount> {
    // Implementación con manejo de compensación para asegurar consistencia
    // Pasos:
    // 1. Validar stock
    // 2. Crear movimiento
    // 3. Actualizar stock
    // 4. Crear cuenta de crédito
    // Si falla la creación de la cuenta, intentar revertir (restaurar stock y borrar movimiento)

    // Verificar stock disponible y obtener precio
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('quantity, selling_price')
      .eq('id', credit.productId)
      .eq('organization_id', this.organizationScope)
      .single();
    if (productError) throw productError;

    const currentQuantity = (product as any).quantity;
    const newQuantity = currentQuantity - credit.quantity;
    if (newQuantity < 0) {
      throw new Error(`Stock insuficiente. Disponible: ${currentQuantity}, Solicitado: ${credit.quantity}`);
    }

    // Preparar movimiento
    const movement: InsertMovement = {
      productId: credit.productId,
      type: 'OUT',
      quantity: credit.quantity,
      reason: `Fiado a: ${credit.customerName}`,
    };

    // Variables para rollback
    let createdMovementId: number | null = null;
    let stockUpdated = false;

    try {
      // Crear movimiento
      const { data: newMovement, error: movementError } = await (supabase as any)
        .from('movements')
        .insert({ ...toSnakeCase(movement), organization_id: this.organizationScope })
        .select()
        .single();
      if (movementError) throw movementError;
      createdMovementId = (newMovement as any).id;

      // Actualizar stock
      const { error: updateError } = await (supabase as any)
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', credit.productId)
        .eq('organization_id', this.organizationScope);
      if (updateError) throw updateError;
      stockUpdated = true;

      // Calcular montos
      const unitPrice = parseFloat((product as any).selling_price);
      const totalAmount = unitPrice * credit.quantity;

      // Crear cuenta de crédito
      const creditData: InsertCreditAccount = {
        customerName: credit.customerName,
        productId: credit.productId,
        movementId: createdMovementId,
        quantity: credit.quantity,
        unitPrice: unitPrice.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paidAmount: '0',
        remainingAmount: totalAmount.toFixed(2),
        status: 'pending',
        notes: credit.notes || null,
      };

      const { data: newCredit, error: creditError } = await (supabase as any)
        .from('credit_accounts')
        .insert({ ...toSnakeCase(creditData), organization_id: this.organizationScope })
        .select()
        .single();
      if (creditError) throw creditError;

      return toCamelCase(newCredit);
    } catch (err) {
      // Intentar revertir cambios si fue creado movimiento o actualizado stock
      try {
        if (stockUpdated) {
          // Restaurar cantidad original
          await (supabase as any)
            .from('products')
            .update({ quantity: currentQuantity })
            .eq('id', credit.productId)
            .eq('organization_id', this.organizationScope);
        }
        if (createdMovementId) {
          await supabase.from('movements').delete().eq('id', createdMovementId).eq('organization_id', this.organizationScope);
        }
      } catch (revertErr) {
        // Si el revert falla, lo registramos y seguimos lanzando el error original
        // eslint-disable-next-line no-console
        console.error('Error during compensating rollback:', revertErr);
      }

      throw err;
    }
  }

  async createCreditPayment(payment: CreateCreditPaymentRequest): Promise<CreditPayment> {
    const { data, error } = await (supabase as any).rpc('register_credit_payment', {
      p_organization_id: this.organizationScope,
      p_credit_account_id: payment.creditAccountId,
      p_amount: payment.amount,
      p_payment_method: payment.paymentMethod ?? null,
      p_notes: payment.notes ?? null,
    });
    if (error) throw error;
    return toCamelCase(data[0]);
  }

  /** @deprecated Replaced by the atomic PostgreSQL function. */
  private async createCreditPaymentLegacy(payment: CreateCreditPaymentRequest): Promise<CreditPayment> {
    // Obtener cuenta de crédito actual
    const { data: credit, error: creditError } = await supabase
      .from('credit_accounts')
      .select('*')
      .eq('id', payment.creditAccountId)
      .eq('organization_id', this.organizationScope)
      .single();
    if (creditError) throw creditError;

    const creditData = credit as any;
    const currentRemaining = parseFloat(creditData.remaining_amount);
    const paymentAmount = parseFloat(payment.amount);

    if (paymentAmount > currentRemaining) {
      throw new Error(`El pago ($${paymentAmount}) excede la deuda restante ($${currentRemaining})`);
    }

    // Crear el pago
    const { data: newPayment, error: paymentError } = await (supabase as any)
      .from('credit_payments')
      .insert({ ...toSnakeCase(payment), organization_id: this.organizationScope })
      .select()
      .single();
    if (paymentError) throw paymentError;

    // Actualizar cuenta de crédito
    const newPaidAmount = parseFloat(creditData.paid_amount) + paymentAmount;
    const newRemainingAmount = currentRemaining - paymentAmount;
    const newStatus = newRemainingAmount === 0 ? 'paid' : 'partial';

    const { error: updateError } = await (supabase as any)
      .from('credit_accounts')
      .update({
        paid_amount: newPaidAmount.toFixed(2),
        remaining_amount: newRemainingAmount.toFixed(2),
        status: newStatus,
      })
      .eq('id', payment.creditAccountId)
      .eq('organization_id', this.organizationScope);
    if (updateError) throw updateError;

    return toCamelCase(newPayment);
  }

  async getCreditsStats(): Promise<CreditsStats> {
    const { data: accounts, error } = await supabase.from('credit_accounts').select('*').eq('organization_id', this.organizationScope);
    if (error) throw error;

    const accountsData = accounts as any[] || [];
    const totalDebt = accountsData.reduce((sum, acc) => sum + parseFloat(acc.remaining_amount || '0'), 0);
    const uniqueCustomers = new Set(accountsData.map(acc => acc.customer_name)).size;
    const pendingAccounts = accountsData.filter(acc => acc.status === 'pending').length;

    return {
      totalDebt,
      totalCustomers: uniqueCustomers,
      pendingAccounts,
    };
  }

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

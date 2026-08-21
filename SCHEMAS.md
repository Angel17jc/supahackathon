# 📋 Resumen de Schemas - Inventory Dashboard

## 🗄️ Tablas de la Base de Datos

### 1. **categories** (Categorías)
Organización de productos por categorías.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| id | SERIAL | PRIMARY KEY | ID único auto-incremental |
| name | TEXT | NOT NULL | Nombre de la categoría |
| description | TEXT | NULL | Descripción opcional |

**Ejemplo:**
```sql
INSERT INTO categories (name, description) VALUES
('Electrónica', 'Productos electrónicos y accesorios');
```

---

### 2. **suppliers** (Proveedores)
Información de proveedores de productos.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| id | SERIAL | PRIMARY KEY | ID único auto-incremental |
| name | TEXT | NOT NULL | Nombre del proveedor |
| contact_info | TEXT | NULL | Email, teléfono, etc. |
| address | TEXT | NULL | Dirección física |

**Ejemplo:**
```sql
INSERT INTO suppliers (name, contact_info, address) VALUES
('TechSupply S.A.', 'contacto@techsupply.com | +34 912 345 678', 'Calle Mayor 123, Madrid');
```

---

### 3. **products** (Productos)
Catálogo completo de productos en inventario.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| id | SERIAL | PRIMARY KEY | ID único auto-incremental |
| name | TEXT | NOT NULL | Nombre del producto |
| description | TEXT | NULL | Descripción detallada |
| sku | TEXT | UNIQUE | Código único del producto |
| quantity | INTEGER | NOT NULL, DEFAULT 0, ≥0 | Cantidad en stock |
| cost_price | DECIMAL(10,2) | NOT NULL, ≥0 | Precio de compra |
| selling_price | DECIMAL(10,2) | NOT NULL, ≥0 | Precio de venta |
| category_id | INTEGER | FK → categories(id) | Relación con categoría |
| supplier_id | INTEGER | FK → suppliers(id) | Relación con proveedor |
| image_url | TEXT | NULL | URL de imagen del producto |
| min_stock_level | INTEGER | DEFAULT 5, ≥0 | Nivel mínimo para alerta |

**Ejemplo:**
```sql
INSERT INTO products (name, sku, quantity, cost_price, selling_price, category_id, supplier_id, min_stock_level) VALUES
('Laptop HP 15', 'LAP-HP-001', 10, 450.00, 699.99, 1, 1, 5);
```

---

### 4. **movements** (Movimientos de Inventario)
Historial de todos los movimientos de stock.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|--------------|-------------|
| id | SERIAL | PRIMARY KEY | ID único auto-incremental |
| product_id | INTEGER | NOT NULL, FK → products(id) | Producto relacionado |
| type | VARCHAR(20) | NOT NULL, IN ('IN','OUT','ADJUSTMENT') | Tipo de movimiento |
| quantity | INTEGER | NOT NULL, >0 | Cantidad movida |
| reason | TEXT | NULL | Motivo del movimiento |
| created_at | TIMESTAMP | DEFAULT NOW() | Fecha y hora |
| user_id | VARCHAR(255) | NULL | Usuario que realizó |

**Tipos de Movimiento:**
- `IN` - Entrada (compras, devoluciones de clientes)
- `OUT` - Salida (ventas, devoluciones a proveedores)
- `ADJUSTMENT` - Ajuste (correcciones, mermas, productos dañados)

**Ejemplo:**
```sql
INSERT INTO movements (product_id, type, quantity, reason) VALUES
(1, 'IN', 10, 'Compra inicial de inventario'),
(1, 'OUT', 2, 'Venta a cliente'),
(1, 'ADJUSTMENT', -1, 'Producto dañado');
```

---

## 🔗 Relaciones

```
categories ──< products >── suppliers
                 │
                 └──< movements
```

- Una **categoría** puede tener muchos **productos** (1:N)
- Un **proveedor** puede tener muchos **productos** (1:N)
- Un **producto** puede tener muchos **movimientos** (1:N)

---

## 📊 Índices (Para Rendimiento)

```sql
-- Productos
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_low_stock ON products(quantity) WHERE quantity <= min_stock_level;

-- Movimientos
CREATE INDEX idx_movements_product ON movements(product_id);
CREATE INDEX idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX idx_movements_type ON movements(type);
CREATE INDEX idx_movements_product_type ON movements(product_id, type);
```

---

## 🎯 Consultas Útiles

### Productos con Stock Bajo
```sql
SELECT name, quantity, min_stock_level
FROM products
WHERE quantity <= min_stock_level
ORDER BY quantity ASC;
```

### Últimos 10 Movimientos
```sql
SELECT m.*, p.name as producto
FROM movements m
JOIN products p ON m.product_id = p.id
ORDER BY m.created_at DESC
LIMIT 10;
```

### Productos por Categoría
```sql
SELECT c.name as categoria, COUNT(p.id) as cantidad_productos
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
GROUP BY c.id, c.name
ORDER BY cantidad_productos DESC;
```

### Valor Total del Inventario
```sql
SELECT 
    SUM(quantity * cost_price::numeric) as valor_costo_total,
    SUM(quantity * selling_price::numeric) as valor_venta_total,
    SUM(quantity * (selling_price::numeric - cost_price::numeric)) as ganancia_potencial
FROM products;
```

### Movimientos por Tipo (Último Mes)
```sql
SELECT 
    type,
    COUNT(*) as cantidad_movimientos,
    SUM(quantity) as unidades_totales
FROM movements
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY type;
```

### Top 5 Productos Más Vendidos
```sql
SELECT 
    p.name,
    SUM(m.quantity) as total_vendido
FROM movements m
JOIN products p ON m.product_id = p.id
WHERE m.type = 'OUT'
    AND m.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name
ORDER BY total_vendido DESC
LIMIT 5;
```

---

## 🔧 Scripts SQL Disponibles

1. **database/schema.sql**
   - Crea todas las tablas
   - Define restricciones y relaciones
   - Crea índices para rendimiento
   - Incluye comentarios de documentación

2. **database/seed.sql**
   - Datos de prueba completos
   - 5 categorías
   - 4 proveedores
   - 18 productos variados
   - 35+ movimientos de ejemplo

---

## 📦 Tipos TypeScript (Generados por Drizzle)

```typescript
// Tipos de selección (lectura)
type Category = {
  id: number;
  name: string;
  description: string | null;
}

type Supplier = {
  id: number;
  name: string;
  contactInfo: string | null;
  address: string | null;
}

type Product = {
  id: number;
  name: string;
  description: string | null;
  sku: string | null;
  quantity: number;
  costPrice: string;
  sellingPrice: string;
  categoryId: number | null;
  supplierId: number | null;
  imageUrl: string | null;
  minStockLevel: number | null;
}

type Movement = {
  id: number;
  productId: number;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: Date | null;
  userId: string | null;
}

// Tipos de inserción (escritura - sin id)
type InsertCategory = Omit<Category, 'id'>;
type InsertSupplier = Omit<Supplier, 'id'>;
type InsertProduct = Omit<Product, 'id'>;
type InsertMovement = Omit<Movement, 'id' | 'createdAt'>;
```

---

## 🚀 Pasos para Usar los Schemas

1. **Crea tu proyecto en Supabase** (ver SUPABASE_SETUP.md)
2. **Copia el contenido de `database/schema.sql`**
3. **Pégalo en el SQL Editor de Supabase**
4. **Ejecuta el script** (Run o Ctrl+Enter)
5. **Verifica las tablas** en Table Editor
6. **(Opcional) Ejecuta `database/seed.sql`** para datos de prueba
7. **Configura tu `.env`** con el DATABASE_URL
8. **Inicia la aplicación** con `npm run dev`

---

✅ **¡Listo para usar!**

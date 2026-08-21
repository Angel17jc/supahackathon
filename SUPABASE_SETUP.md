# 🚀 Configuración de Supabase para Inventory Dashboard

Este documento te guiará paso a paso para configurar tu base de datos PostgreSQL en Supabase.

## 📋 Prerequisitos

1. Una cuenta en [Supabase](https://supabase.com)
2. Node.js instalado en tu sistema

## 🔧 Pasos de Configuración

### 1. Crear un Proyecto en Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Haz clic en **"New Project"**
3. Completa los datos:
   - **Name**: Inventory Dashboard (o el nombre que prefieras)
   - **Database Password**: Crea una contraseña segura (¡guárdala!)
   - **Region**: Selecciona la región más cercana a ti
4. Haz clic en **"Create new project"**
5. Espera unos 2 minutos mientras Supabase configura tu base de datos

### 2. Obtener la Connection String

1. En tu proyecto de Supabase, ve a **Settings** (⚙️) en el menú lateral
2. Haz clic en **Database**
3. En la sección **"Connection string"**, selecciona **"URI"**
4. Copia la cadena de conexión que se ve así:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```
5. Reemplaza `[YOUR-PASSWORD]` con la contraseña que creaste en el paso 1

### 3. Configurar Variables de Entorno

1. Crea un archivo `.env` en la raíz del proyecto (si no existe)
2. Agrega tu connection string:
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxx.supabase.co:5432/postgres
   ```

### 4. Crear las Tablas

Tienes **dos opciones** para crear las tablas:

#### Opción A: Usar el SQL Editor de Supabase (Recomendado)

1. En tu proyecto de Supabase, ve a **SQL Editor** en el menú lateral
2. Copia todo el contenido del archivo `database/schema.sql` (ver más abajo)
3. Pégalo en el editor SQL
4. Haz clic en **"Run"** o presiona `Ctrl + Enter`

#### Opción B: Usar Drizzle Kit

1. Ejecuta en tu terminal:
   ```bash
   npm run db:push
   ```
2. Drizzle Kit creará automáticamente las tablas basándose en el schema de TypeScript

### 5. Verificar las Tablas

1. En Supabase, ve a **Table Editor**
2. Deberías ver 4 tablas:
   - `categories`
   - `suppliers`
   - `products`
   - `movements`

### 6. Iniciar el Proyecto

```bash
npm run dev
```

El servidor debería iniciar correctamente en [http://localhost:5000](http://localhost:5000)

## 📊 Schema SQL

Si prefieres la **Opción A**, copia y ejecuta este SQL en Supabase:

```sql
-- Tabla de Categorías
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

-- Tabla de Proveedores
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_info TEXT,
    address TEXT
);

-- Tabla de Productos
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    cost_price DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    image_url TEXT,
    min_stock_level INTEGER DEFAULT 5
);

-- Tabla de Movimientos de Inventario
CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(255)
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);

-- Comentarios para documentación
COMMENT ON TABLE categories IS 'Categorías de productos';
COMMENT ON TABLE suppliers IS 'Proveedores de productos';
COMMENT ON TABLE products IS 'Inventario de productos';
COMMENT ON TABLE movements IS 'Historial de movimientos de inventario (entradas, salidas, ajustes)';

COMMENT ON COLUMN movements.type IS 'Tipo de movimiento: IN (entrada), OUT (salida), ADJUSTMENT (ajuste)';
COMMENT ON COLUMN products.min_stock_level IS 'Nivel mínimo de stock para alertas';
```

## 🎯 Datos de Prueba (Opcional)

Para agregar datos de prueba, ejecuta este SQL en Supabase:

```sql
-- Insertar categorías de ejemplo
INSERT INTO categories (name, description) VALUES
    ('Electrónica', 'Productos electrónicos y accesorios'),
    ('Oficina', 'Artículos de oficina y papelería'),
    ('Hogar', 'Artículos para el hogar');

-- Insertar proveedores de ejemplo
INSERT INTO suppliers (name, contact_info, address) VALUES
    ('TechSupply S.A.', 'contacto@techsupply.com | +34 912 345 678', 'Calle Mayor 123, Madrid'),
    ('Oficina Plus', 'ventas@oficinaplus.com | +34 933 456 789', 'Av. Diagonal 456, Barcelona');

-- Insertar productos de ejemplo
INSERT INTO products (name, description, sku, quantity, cost_price, selling_price, category_id, supplier_id, min_stock_level) VALUES
    ('Laptop HP 15', 'Laptop HP 15 pulgadas, 8GB RAM, 256GB SSD', 'LAP-HP-001', 10, 450.00, 699.99, 1, 1, 3),
    ('Mouse Inalámbrico', 'Mouse óptico inalámbrico 2.4GHz', 'MOU-WIR-001', 50, 8.50, 15.99, 1, 1, 10),
    ('Resma A4', 'Papel A4 500 hojas', 'PAP-A4-001', 100, 2.50, 4.99, 2, 2, 20);

-- Insertar movimientos de ejemplo
INSERT INTO movements (product_id, type, quantity, reason) VALUES
    (1, 'IN', 10, 'Compra inicial de inventario'),
    (2, 'IN', 50, 'Reposición de stock'),
    (3, 'IN', 100, 'Compra mensual'),
    (2, 'OUT', 5, 'Venta a cliente'),
    (3, 'OUT', 10, 'Venta corporativa');
```

## 🔐 Seguridad

⚠️ **IMPORTANTE**: 
- **NUNCA** subas tu archivo `.env` a Git
- El `.env` ya está incluido en `.gitignore`
- Comparte solo `.env.example` con tu equipo
- Mantén tu `DATABASE_URL` en secreto

## 🆘 Solución de Problemas

### Error: "DATABASE_URL must be set"
- Verifica que el archivo `.env` existe en la raíz del proyecto
- Verifica que la variable `DATABASE_URL` está correctamente configurada
- Reinicia el servidor después de crear/modificar `.env`

### Error de conexión a la base de datos
- Verifica que reemplazaste `[YOUR-PASSWORD]` con tu contraseña real
- Verifica que no hay espacios extras en la connection string
- Verifica que tu proyecto de Supabase está activo (no pausado)

### Las tablas no se crean
- Verifica que ejecutaste el SQL completo sin errores
- Revisa la consola de Supabase para ver mensajes de error
- Intenta ejecutar cada tabla por separado

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## ✅ Checklist de Configuración

- [ ] Cuenta de Supabase creada
- [ ] Proyecto de Supabase creado
- [ ] Connection string obtenida
- [ ] Archivo `.env` creado con `DATABASE_URL`
- [ ] Tablas creadas (via SQL o Drizzle)
- [ ] Tablas verificadas en Table Editor
- [ ] Datos de prueba insertados (opcional)
- [ ] Servidor iniciado con `npm run dev`
- [ ] Aplicación accesible en el navegador

---

¿Necesitas ayuda? Abre un issue en el repositorio o contacta al equipo de desarrollo.

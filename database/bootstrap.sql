-- =====================================================================
-- BOOTSTRAP COMPLETO PARA UNA BASE DE DATOS SUPABASE NUEVA Y VACIA
-- =====================================================================
-- Genera el esquema completo (inventario + fiados + multi-tenant + RLS)
-- en el orden correcto y en una sola ejecucion.
--
-- USO: SQL Editor de Supabase -> pegar todo -> Run.
--
-- IMPORTANTE: pensado para correrse UNA sola vez sobre una base vacia.
-- No es re-ejecutable: varias migraciones usan ADD CONSTRAINT sin guarda.
-- Si algo falla a mitad, resetea la base y vuelve a empezar.
--
-- Orden: tablas -> fiados -> datos demo -> organizaciones -> scoping
--        -> RLS -> politicas -> funciones atomicas -> refuerzos.
-- =====================================================================



-- =====================================================================
-- PASO 1: Tablas base del inventario
-- Origen: database/schema.sql
-- =====================================================================

-- ================================================
-- INVENTORY DASHBOARD - SUPABASE DATABASE SCHEMA
-- ================================================
-- Este archivo contiene todo el schema SQL necesario
-- para crear las tablas en Supabase PostgreSQL
-- ================================================

-- Eliminar tablas si existen (para desarrollo/reset)
-- ¡CUIDADO! Esto borrará todos los datos
-- DROP TABLE IF EXISTS movements CASCADE;
-- DROP TABLE IF EXISTS products CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS suppliers CASCADE;

-- ================================================
-- TABLA: categories
-- Descripción: Categorías de productos
-- ================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT
);

-- ================================================
-- TABLA: suppliers
-- Descripción: Proveedores de productos
-- ================================================
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_info TEXT,
    address TEXT
);

-- ================================================
-- TABLA: products
-- Descripción: Inventario de productos
-- ================================================
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
    min_stock_level INTEGER DEFAULT 5,
    
    -- Constraints
    CONSTRAINT positive_quantity CHECK (quantity >= 0),
    CONSTRAINT positive_cost_price CHECK (cost_price >= 0),
    CONSTRAINT positive_selling_price CHECK (selling_price >= 0),
    CONSTRAINT positive_min_stock CHECK (min_stock_level >= 0)
);

-- ================================================
-- TABLA: movements
-- Descripción: Historial de movimientos de inventario
-- Tipos: IN (entrada), OUT (salida), ADJUSTMENT (ajuste)
-- ================================================
CREATE TABLE IF NOT EXISTS movements (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
    quantity INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(255),
    
    -- Constraints
    CONSTRAINT positive_movement_quantity CHECK (quantity > 0)
);

-- ================================================
-- ÍNDICES PARA MEJORAR EL RENDIMIENTO
-- ================================================

-- Índices en products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(quantity) WHERE quantity <= min_stock_level;

-- Índices en movements
CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type);
CREATE INDEX IF NOT EXISTS idx_movements_product_type ON movements(product_id, type);

-- ================================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- ================================================

COMMENT ON TABLE categories IS 'Categorías de productos para organización del inventario';
COMMENT ON TABLE suppliers IS 'Proveedores de productos con información de contacto';
COMMENT ON TABLE products IS 'Catálogo completo de productos en inventario';
COMMENT ON TABLE movements IS 'Historial de todos los movimientos de inventario (entradas, salidas, ajustes)';

COMMENT ON COLUMN products.sku IS 'Stock Keeping Unit - Código único del producto';
COMMENT ON COLUMN products.cost_price IS 'Precio de costo/compra del producto';
COMMENT ON COLUMN products.selling_price IS 'Precio de venta al público';
COMMENT ON COLUMN products.min_stock_level IS 'Nivel mínimo de stock para generar alertas de reposición';

COMMENT ON COLUMN movements.type IS 'Tipo de movimiento: IN (entrada/compra), OUT (salida/venta), ADJUSTMENT (ajuste de inventario)';
COMMENT ON COLUMN movements.quantity IS 'Cantidad de productos movidos (siempre positivo)';
COMMENT ON COLUMN movements.user_id IS 'ID del usuario que realizó el movimiento (opcional)';

-- ================================================
-- FUNCIONES Y TRIGGERS (OPCIONAL - AVANZADO)
-- ================================================

-- Función para actualizar automáticamente el stock cuando hay un movimiento
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'IN' THEN
        UPDATE products SET quantity = quantity + NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.type = 'OUT' THEN
        UPDATE products SET quantity = quantity - NEW.quantity WHERE id = NEW.product_id;
    ELSIF NEW.type = 'ADJUSTMENT' THEN
        -- Para ajustes, el valor de quantity representa el nuevo stock total
        -- Este comportamiento puede ajustarse según necesidad
        UPDATE products SET quantity = NEW.quantity WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar stock automáticamente (COMENTADO - activar si se desea)
-- ¡IMPORTANTE! Solo descomenta si deseas que el stock se actualice automáticamente
-- En este proyecto, el backend maneja las actualizaciones de stock manualmente
-- CREATE TRIGGER trigger_update_stock
-- AFTER INSERT ON movements
-- FOR EACH ROW
-- EXECUTE FUNCTION update_product_stock();

-- ================================================
-- POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- ================================================
-- Supabase recomienda habilitar RLS para seguridad
-- Descomenta estas líneas si usas autenticación de Supabase

-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE movements ENABLE ROW LEVEL SECURITY;

-- Política de ejemplo: permitir lectura a todos los usuarios autenticados
-- CREATE POLICY "Allow read access to authenticated users" ON products
--     FOR SELECT TO authenticated
--     USING (true);

-- Política de ejemplo: permitir escritura solo a usuarios autenticados
-- CREATE POLICY "Allow insert to authenticated users" ON movements
--     FOR INSERT TO authenticated
--     WITH CHECK (true);

-- ================================================
-- FIN DEL SCHEMA
-- ================================================

-- Para verificar que todo se creó correctamente, ejecuta:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';


-- =====================================================================
-- PASO 2: Modulo de fiados (cuentas de credito y pagos)
-- Origen: database/credits.sql
-- =====================================================================

-- Tabla de cuentas de crédito (fiado)
CREATE TABLE IF NOT EXISTS credit_accounts (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_id INTEGER REFERENCES movements(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_amounts CHECK (
    unit_price >= 0 AND 
    total_amount >= 0 AND 
    paid_amount >= 0 AND 
    remaining_amount >= 0
  ),
  CONSTRAINT valid_amounts CHECK (total_amount = unit_price * quantity)
);

-- Tabla de pagos de crédito
CREATE TABLE IF NOT EXISTS credit_payments (
  id SERIAL PRIMARY KEY,
  credit_account_id INTEGER NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_payment CHECK (amount > 0)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_credit_accounts_customer ON credit_accounts(customer_name);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_status ON credit_accounts(status);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_product ON credit_accounts(product_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_account ON credit_payments(credit_account_id);

-- Función para actualizar el timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar automáticamente updated_at
DROP TRIGGER IF EXISTS update_credit_accounts_updated_at ON credit_accounts;
CREATE TRIGGER update_credit_accounts_updated_at 
  BEFORE UPDATE ON credit_accounts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Vista para resumen de deudas por cliente
CREATE OR REPLACE VIEW customer_debts AS
SELECT 
  customer_name,
  COUNT(*) as total_accounts,
  SUM(total_amount) as total_debt,
  SUM(paid_amount) as total_paid,
  SUM(remaining_amount) as total_remaining,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_accounts,
  COUNT(*) FILTER (WHERE status = 'partial') as partial_accounts,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_accounts
FROM credit_accounts
GROUP BY customer_name;

COMMENT ON TABLE credit_accounts IS 'Cuentas de crédito para clientes que fían productos';
COMMENT ON TABLE credit_payments IS 'Pagos realizados a cuentas de crédito';
COMMENT ON COLUMN credit_accounts.status IS 'Estado: pending (sin pagar), partial (pago parcial), paid (pagado completo)';
COMMENT ON VIEW customer_debts IS 'Resumen de deudas agrupadas por cliente';


-- =====================================================================
-- PASO 3: Datos de demostracion (borra este bloque si no los quieres)
-- Origen: database/seed.sql
-- =====================================================================

-- ================================================
-- DATOS DE PRUEBA PARA INVENTORY DASHBOARD
-- ================================================
-- Este archivo contiene datos de ejemplo para probar
-- la aplicación con información realista
-- ================================================

-- ================================================
-- INSERTAR CATEGORÍAS
-- ================================================
INSERT INTO categories (name, description) VALUES
    ('Electrónica', 'Productos electrónicos, computadoras y accesorios tecnológicos'),
    ('Oficina', 'Artículos de oficina, papelería y suministros'),
    ('Hogar', 'Artículos para el hogar y decoración'),
    ('Herramientas', 'Herramientas manuales y eléctricas'),
    ('Deportes', 'Equipamiento deportivo y fitness');

-- ================================================
-- INSERTAR PROVEEDORES
-- ================================================
INSERT INTO suppliers (name, contact_info, address) VALUES
    ('TechSupply S.A.', 'contacto@techsupply.com | +34 912 345 678', 'Calle Mayor 123, Madrid 28013'),
    ('Oficina Plus', 'ventas@oficinaplus.com | +34 933 456 789', 'Av. Diagonal 456, Barcelona 08006'),
    ('Distribuidora Global', 'info@distglobal.com | +34 955 123 456', 'Calle Sierpes 78, Sevilla 41004'),
    ('Import Electronics', 'sales@importelec.com | +34 963 789 012', 'Gran Vía 234, Valencia 46005');

-- ================================================
-- INSERTAR PRODUCTOS
-- ================================================
INSERT INTO products (name, description, sku, quantity, cost_price, selling_price, category_id, supplier_id, min_stock_level, image_url) VALUES
    -- Electrónica
    ('Laptop HP 15', 'Laptop HP 15.6" Intel Core i5, 8GB RAM, 256GB SSD, Windows 11', 'LAP-HP-001', 15, 450.00, 699.99, 1, 1, 5, NULL),
    ('Mouse Inalámbrico Logitech', 'Mouse óptico inalámbrico 2.4GHz, 3 botones, ergonómico', 'MOU-LOG-001', 50, 8.50, 15.99, 1, 1, 15, NULL),
    ('Teclado Mecánico RGB', 'Teclado mecánico gaming, switches azules, retroiluminación RGB', 'TEC-RGB-001', 30, 35.00, 69.99, 1, 4, 10, NULL),
    ('Monitor 24" Full HD', 'Monitor LED 24 pulgadas, 1920x1080, HDMI, VGA', 'MON-24-001', 20, 95.00, 159.99, 1, 1, 8, NULL),
    ('Auriculares Bluetooth', 'Auriculares inalámbricos con cancelación de ruido, 30h batería', 'AUR-BT-001', 40, 25.00, 49.99, 1, 4, 12, NULL),
    
    -- Oficina
    ('Resma Papel A4', 'Papel blanco A4 80g, 500 hojas, alta blancura', 'PAP-A4-001', 200, 2.50, 4.99, 2, 2, 50, NULL),
    ('Bolígrafos Azules (Pack 10)', 'Set de 10 bolígrafos azules punta fina 0.7mm', 'BOL-AZ-010', 100, 1.20, 2.99, 2, 2, 30, NULL),
    ('Carpetas Archivador', 'Carpeta archivador de palanca, tamaño folio, colores surtidos', 'CAR-ARC-001', 75, 1.80, 3.99, 2, 2, 25, NULL),
    ('Calculadora Científica', 'Calculadora científica con 240 funciones, pantalla LCD', 'CAL-CIE-001', 25, 8.00, 15.99, 2, 2, 10, NULL),
    
    -- Hogar
    ('Lámpara de Escritorio LED', 'Lámpara LED regulable, brazo flexible, luz cálida/fría', 'LAM-LED-001', 35, 12.00, 24.99, 3, 3, 10, NULL),
    ('Organizador de Cajones', 'Organizador modular para cajones, 6 compartimentos', 'ORG-CAJ-001', 60, 4.50, 9.99, 3, 3, 20, NULL),
    ('Papelera 10L', 'Papelera de acero inoxidable con pedal, 10 litros', 'PAP-10L-001', 40, 8.00, 16.99, 3, 3, 15, NULL),
    
    -- Herramientas
    ('Juego Destornilladores 12pz', 'Set de 12 destornilladores de precisión, magnéticos', 'DES-12P-001', 45, 10.00, 19.99, 4, 3, 15, NULL),
    ('Taladro Inalámbrico 18V', 'Taladro atornillador inalámbrico, 2 baterías, maletín', 'TAL-18V-001', 12, 55.00, 109.99, 4, 3, 5, NULL),
    ('Cinta Métrica 5m', 'Cinta métrica profesional 5 metros, carcasa resistente', 'CIN-5M-001', 80, 3.50, 7.99, 4, 3, 25, NULL),
    
    -- Deportes
    ('Mancuernas Ajustables 20kg', 'Par de mancuernas ajustables hasta 20kg, soporte incluido', 'MAN-20K-001', 18, 45.00, 89.99, 5, 3, 8, NULL),
    ('Esterilla Yoga Premium', 'Esterilla antideslizante 6mm, incluye correa de transporte', 'EST-YOG-001', 50, 8.00, 16.99, 5, 3, 15, NULL),
    ('Botella Deportiva 1L', 'Botella térmica de acero inoxidable, mantiene frío 24h', 'BOT-1L-001', 70, 6.00, 12.99, 5, 3, 20, NULL);

-- ================================================
-- INSERTAR MOVIMIENTOS
-- ================================================
INSERT INTO movements (product_id, type, quantity, reason, created_at) VALUES
    -- Entradas iniciales de inventario (hace 30 días)
    (1, 'IN', 15, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    (2, 'IN', 50, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    (3, 'IN', 30, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    (4, 'IN', 20, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    (5, 'IN', 40, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    (6, 'IN', 200, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    (7, 'IN', 100, 'Compra inicial de inventario', NOW() - INTERVAL '30 days'),
    
    -- Salidas por ventas (últimos 15 días)
    (2, 'OUT', 8, 'Venta a cliente corporativo', NOW() - INTERVAL '15 days'),
    (6, 'OUT', 25, 'Venta mayorista', NOW() - INTERVAL '14 days'),
    (7, 'OUT', 15, 'Venta retail', NOW() - INTERVAL '13 days'),
    (1, 'OUT', 2, 'Venta a cliente', NOW() - INTERVAL '12 days'),
    (5, 'OUT', 5, 'Venta online', NOW() - INTERVAL '11 days'),
    
    -- Más entradas (hace 10 días)
    (2, 'IN', 30, 'Reposición de stock', NOW() - INTERVAL '10 days'),
    (6, 'IN', 100, 'Compra mensual', NOW() - INTERVAL '10 days'),
    
    -- Más salidas recientes (última semana)
    (3, 'OUT', 5, 'Venta a tienda', NOW() - INTERVAL '7 days'),
    (4, 'OUT', 3, 'Venta especial', NOW() - INTERVAL '6 days'),
    (6, 'OUT', 20, 'Pedido corporativo', NOW() - INTERVAL '5 days'),
    (2, 'OUT', 12, 'Venta promocional', NOW() - INTERVAL '4 days'),
    
    -- Ajustes de inventario (hace 3 días)
    (7, 'ADJUSTMENT', 5, 'Productos dañados en almacén', NOW() - INTERVAL '3 days'),
    (6, 'ADJUSTMENT', 10, 'Corrección de conteo físico', NOW() - INTERVAL '3 days'),
    
    -- Movimientos muy recientes (últimos 2 días)
    (1, 'OUT', 1, 'Venta cliente VIP', NOW() - INTERVAL '2 days'),
    (5, 'OUT', 3, 'Venta online', NOW() - INTERVAL '1 day'),
    (6, 'OUT', 15, 'Venta a oficina', NOW() - INTERVAL '1 day'),
    (8, 'IN', 75, 'Nueva compra', NOW() - INTERVAL '1 day'),
    (9, 'IN', 25, 'Nueva compra', NOW() - INTERVAL '1 day'),
    
    -- Movimientos de hoy
    (2, 'OUT', 5, 'Venta matutina', NOW() - INTERVAL '4 hours'),
    (10, 'IN', 35, 'Recepción de proveedor', NOW() - INTERVAL '3 hours'),
    (11, 'IN', 60, 'Recepción de proveedor', NOW() - INTERVAL '2 hours'),
    (12, 'IN', 40, 'Recepción de proveedor', NOW() - INTERVAL '1 hour'),
    (13, 'IN', 45, 'Compra de herramientas', NOW() - INTERVAL '1 hour'),
    (14, 'IN', 12, 'Compra de herramientas', NOW() - INTERVAL '1 hour'),
    (15, 'IN', 80, 'Compra de herramientas', NOW() - INTERVAL '1 hour'),
    (16, 'IN', 18, 'Compra equipamiento deportivo', NOW() - INTERVAL '30 minutes'),
    (17, 'IN', 50, 'Compra equipamiento deportivo', NOW() - INTERVAL '30 minutes'),
    (18, 'IN', 70, 'Compra equipamiento deportivo', NOW() - INTERVAL '30 minutes');

-- ================================================
-- VERIFICACIÓN DE DATOS
-- ================================================
-- Ejecuta estas consultas para verificar los datos insertados:

-- SELECT COUNT(*) as total_categorias FROM categories;
-- SELECT COUNT(*) as total_proveedores FROM suppliers;
-- SELECT COUNT(*) as total_productos FROM products;
-- SELECT COUNT(*) as total_movimientos FROM movements;

-- Ver productos por categoría:
-- SELECT c.name as categoria, COUNT(p.id) as cantidad_productos
-- FROM categories c
-- LEFT JOIN products p ON c.id = p.category_id
-- GROUP BY c.id, c.name
-- ORDER BY cantidad_productos DESC;

-- Ver productos con bajo stock:
-- SELECT name, quantity, min_stock_level
-- FROM products
-- WHERE quantity <= min_stock_level
-- ORDER BY quantity ASC;

-- Ver últimos 10 movimientos:
-- SELECT m.*, p.name as producto, m.created_at
-- FROM movements m
-- JOIN products p ON m.product_id = p.id
-- ORDER BY m.created_at DESC
-- LIMIT 10;


-- =====================================================================
-- PASO 4: Organizaciones, membresias y helpers de rol
-- Origen: database/migrations/002_saas_foundation.sql
-- =====================================================================

-- SaaS multi-tenant foundation. This migration is additive and does not alter
-- existing inventory data; legacy rows will be assigned to an organization in
-- the following migration.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Preserve access for administrators configured by the previous single-store
-- release. New platform administrators must receive this field explicitly.
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
  || '{"platform_role":"platform_admin"}'::jsonb
WHERE raw_app_meta_data ->> 'role' = 'admin'
  AND COALESCE(raw_app_meta_data ->> 'platform_role', '') <> 'platform_admin';

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_memberships_user
  ON organization_memberships(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_organization_memberships_organization
  ON organization_memberships(organization_id) WHERE status = 'active';

CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

DROP TRIGGER IF EXISTS update_organization_memberships_updated_at ON organization_memberships;
CREATE TRIGGER update_organization_memberships_updated_at
  BEFORE UPDATE ON organization_memberships
  FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

-- The platform role is controlled only through Supabase Auth app_metadata.
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') = 'platform_admin';
$$;

-- SECURITY DEFINER avoids recursive RLS checks when resolving a membership.
CREATE OR REPLACE FUNCTION is_active_organization_member(target_organization_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_memberships membership
    WHERE membership.organization_id = target_organization_id
      AND membership.user_id = auth.uid()
      AND membership.status = 'active'
  );
$$;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_member ON organizations;
CREATE POLICY organizations_select_member ON organizations
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(id));

DROP POLICY IF EXISTS organizations_manage_platform_admin ON organizations;
CREATE POLICY organizations_manage_platform_admin ON organizations
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS memberships_select_member ON organization_memberships;
CREATE POLICY memberships_select_member ON organization_memberships
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS memberships_manage_platform_admin ON organization_memberships;
CREATE POLICY memberships_manage_platform_admin ON organization_memberships
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());


-- =====================================================================
-- PASO 5: Asignar los datos existentes a una organizacion
-- Origen: database/migrations/003_scope_legacy_data_to_organization.sql
-- =====================================================================

-- Run after 002_saas_foundation.sql. This migration keeps all existing data
-- and places it in one legacy organization before tenant-scoped API access is enabled.

DO $$
DECLARE
  legacy_organization_id UUID;
BEGIN
  SELECT id INTO legacy_organization_id
  FROM organizations
  WHERE slug = 'legacy-inventory';

  IF legacy_organization_id IS NULL THEN
    INSERT INTO organizations (name, slug)
    VALUES ('Inventario existente', 'legacy-inventory')
    RETURNING id INTO legacy_organization_id;
  END IF;

  ALTER TABLE categories ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE movements ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE credit_payments ADD COLUMN IF NOT EXISTS organization_id UUID;

  UPDATE categories SET organization_id = legacy_organization_id WHERE organization_id IS NULL;
  UPDATE suppliers SET organization_id = legacy_organization_id WHERE organization_id IS NULL;
  UPDATE products SET organization_id = legacy_organization_id WHERE organization_id IS NULL;
  UPDATE movements SET organization_id = legacy_organization_id WHERE organization_id IS NULL;
  UPDATE credit_accounts SET organization_id = legacy_organization_id WHERE organization_id IS NULL;
  UPDATE credit_payments SET organization_id = legacy_organization_id WHERE organization_id IS NULL;
END $$;

ALTER TABLE categories ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE suppliers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE products ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE movements ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE credit_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE credit_payments ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE categories
  ADD CONSTRAINT categories_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE products
  ADD CONSTRAINT products_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE movements
  ADD CONSTRAINT movements_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE credit_accounts
  ADD CONSTRAINT credit_accounts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
ALTER TABLE credit_payments
  ADD CONSTRAINT credit_payments_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;

-- Tenant-local uniqueness and relationship integrity.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_organization_sku
  ON products(organization_id, sku) WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_id_organization
  ON categories(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_id_organization
  ON suppliers(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_id_organization
  ON products(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_movements_id_organization
  ON movements(id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_accounts_id_organization
  ON credit_accounts(id, organization_id);

ALTER TABLE products
  ADD CONSTRAINT products_category_organization_fkey
  FOREIGN KEY (category_id, organization_id)
  REFERENCES categories(id, organization_id) ON DELETE SET NULL (category_id);
ALTER TABLE products
  ADD CONSTRAINT products_supplier_organization_fkey
  FOREIGN KEY (supplier_id, organization_id)
  REFERENCES suppliers(id, organization_id) ON DELETE SET NULL (supplier_id);
ALTER TABLE movements
  ADD CONSTRAINT movements_product_organization_fkey
  FOREIGN KEY (product_id, organization_id)
  REFERENCES products(id, organization_id) ON DELETE CASCADE;
ALTER TABLE credit_accounts
  ADD CONSTRAINT credit_accounts_product_organization_fkey
  FOREIGN KEY (product_id, organization_id)
  REFERENCES products(id, organization_id) ON DELETE RESTRICT;
ALTER TABLE credit_accounts
  ADD CONSTRAINT credit_accounts_movement_organization_fkey
  FOREIGN KEY (movement_id, organization_id)
  REFERENCES movements(id, organization_id) ON DELETE SET NULL (movement_id);
ALTER TABLE credit_payments
  ADD CONSTRAINT credit_payments_account_organization_fkey
  FOREIGN KEY (credit_account_id, organization_id)
  REFERENCES credit_accounts(id, organization_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_categories_organization ON categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_organization ON suppliers(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_organization ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_movements_organization_created_at ON movements(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_organization_status ON credit_accounts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_payments_organization ON credit_payments(organization_id);

DROP VIEW IF EXISTS customer_debts;
CREATE VIEW customer_debts AS
SELECT
  organization_id,
  customer_name,
  COUNT(*) AS total_accounts,
  SUM(total_amount) AS total_debt,
  SUM(paid_amount) AS total_paid,
  SUM(remaining_amount) AS total_remaining,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_accounts,
  COUNT(*) FILTER (WHERE status = 'partial') AS partial_accounts,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_accounts
FROM credit_accounts
GROUP BY organization_id, customer_name;


-- =====================================================================
-- PASO 6: Activar RLS en todas las tablas de datos
-- Origen: database/migrations/001_enable_rls.sql
-- =====================================================================

-- All application access must go through the Express API, which validates Supabase JWTs.
-- No client-side table policies are created: RLS therefore denies direct table access by default.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;


-- =====================================================================
-- PASO 7: Politicas RLS por tenant
-- Origen: database/migrations/004_apply_tenant_data_rls.sql
-- =====================================================================

-- Run after 003_scope_legacy_data_to_organization.sql.
-- Browser clients may read only their active organization. All writes remain
-- API-only: the Express server validates permissions and uses the service key.

DROP POLICY IF EXISTS categories_select_tenant ON categories;
CREATE POLICY categories_select_tenant ON categories
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(organization_id));

DROP POLICY IF EXISTS suppliers_select_tenant ON suppliers;
CREATE POLICY suppliers_select_tenant ON suppliers
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(organization_id));

DROP POLICY IF EXISTS products_select_tenant ON products;
CREATE POLICY products_select_tenant ON products
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(organization_id));

DROP POLICY IF EXISTS movements_select_tenant ON movements;
CREATE POLICY movements_select_tenant ON movements
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(organization_id));

DROP POLICY IF EXISTS credit_accounts_select_tenant ON credit_accounts;
CREATE POLICY credit_accounts_select_tenant ON credit_accounts
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(organization_id));

DROP POLICY IF EXISTS credit_payments_select_tenant ON credit_payments;
CREATE POLICY credit_payments_select_tenant ON credit_payments
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(organization_id));


-- =====================================================================
-- PASO 8: Operaciones atomicas de inventario y fiados
-- Origen: database/migrations/005_atomic_inventory_operations.sql
-- =====================================================================

-- Run after the tenant migrations. These functions are API-only operations:
-- they serialize concurrent changes with row locks and keep inventory history
-- and balances in one PostgreSQL transaction.

CREATE OR REPLACE FUNCTION create_inventory_movement(
  p_organization_id UUID,
  p_product_id INTEGER,
  p_type VARCHAR,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity INTEGER;
  resulting_quantity INTEGER;
BEGIN
  IF p_type NOT IN ('IN', 'OUT', 'ADJUSTMENT') THEN
    RAISE EXCEPTION 'Invalid movement type' USING ERRCODE = '22023';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero' USING ERRCODE = '22023';
  END IF;

  SELECT quantity INTO current_quantity
  FROM products
  WHERE id = p_product_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in organization' USING ERRCODE = 'P0002';
  END IF;

  resulting_quantity := CASE
    WHEN p_type = 'IN' THEN current_quantity + p_quantity
    WHEN p_type = 'OUT' THEN current_quantity - p_quantity
    ELSE p_quantity
  END;
  IF resulting_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, requested: %', current_quantity, p_quantity USING ERRCODE = '22000';
  END IF;

  UPDATE products
  SET quantity = resulting_quantity
  WHERE id = p_product_id AND organization_id = p_organization_id;

  RETURN QUERY
  INSERT INTO movements (organization_id, product_id, type, quantity, reason, user_id)
  VALUES (p_organization_id, p_product_id, p_type, p_quantity, p_reason, p_user_id::VARCHAR)
  RETURNING movements.*;
END;
$$;

CREATE OR REPLACE FUNCTION create_credit_sale(
  p_organization_id UUID,
  p_product_id INTEGER,
  p_customer_name TEXT,
  p_quantity INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity INTEGER;
  unit_price NUMERIC(10,2);
  movement_record movements;
  total NUMERIC(10,2);
BEGIN
  IF length(trim(p_customer_name)) = 0 OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Customer name and positive quantity are required' USING ERRCODE = '22023';
  END IF;

  SELECT quantity, selling_price INTO current_quantity, unit_price
  FROM products
  WHERE id = p_product_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in organization' USING ERRCODE = 'P0002';
  END IF;
  IF current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, requested: %', current_quantity, p_quantity USING ERRCODE = '22000';
  END IF;

  UPDATE products SET quantity = quantity - p_quantity
  WHERE id = p_product_id AND organization_id = p_organization_id;

  INSERT INTO movements (organization_id, product_id, type, quantity, reason, user_id)
  VALUES (p_organization_id, p_product_id, 'OUT', p_quantity, 'Fiado a: ' || trim(p_customer_name), p_user_id::VARCHAR)
  RETURNING * INTO movement_record;

  total := unit_price * p_quantity;
  RETURN QUERY
  INSERT INTO credit_accounts (
    organization_id, customer_name, product_id, movement_id, quantity,
    unit_price, total_amount, paid_amount, remaining_amount, status, notes
  ) VALUES (
    p_organization_id, trim(p_customer_name), p_product_id, movement_record.id, p_quantity,
    unit_price, total, 0, total, 'pending', p_notes
  ) RETURNING credit_accounts.*;
END;
$$;

CREATE OR REPLACE FUNCTION register_credit_payment(
  p_organization_id UUID,
  p_credit_account_id INTEGER,
  p_amount NUMERIC(10,2),
  p_payment_method VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS SETOF credit_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_record credit_accounts;
  next_remaining NUMERIC(10,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO account_record
  FROM credit_accounts
  WHERE id = p_credit_account_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit account not found in organization' USING ERRCODE = 'P0002';
  END IF;
  IF account_record.status = 'paid' OR p_amount > account_record.remaining_amount THEN
    RAISE EXCEPTION 'Payment exceeds the remaining balance' USING ERRCODE = '22000';
  END IF;

  next_remaining := account_record.remaining_amount - p_amount;
  UPDATE credit_accounts
  SET paid_amount = paid_amount + p_amount,
      remaining_amount = next_remaining,
      status = CASE WHEN next_remaining = 0 THEN 'paid' ELSE 'partial' END
  WHERE id = p_credit_account_id AND organization_id = p_organization_id;

  RETURN QUERY
  INSERT INTO credit_payments (organization_id, credit_account_id, amount, payment_method, notes)
  VALUES (p_organization_id, p_credit_account_id, p_amount, p_payment_method, p_notes)
  RETURNING credit_payments.*;
END;
$$;

REVOKE ALL ON FUNCTION create_inventory_movement(UUID, INTEGER, VARCHAR, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_credit_sale(UUID, INTEGER, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION register_credit_payment(UUID, INTEGER, NUMERIC, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_inventory_movement(UUID, INTEGER, VARCHAR, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_credit_sale(UUID, INTEGER, TEXT, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION register_credit_payment(UUID, INTEGER, NUMERIC, VARCHAR, TEXT) TO service_role;


-- =====================================================================
-- PASO 9: Reforzar RLS y revocar privilegios a anon/authenticated
-- Origen: database/migrations/006_restore_organizations_rls.sql
-- =====================================================================

-- Fixes the Supabase advisor finding `rls_disabled_in_public` on `organizations`.
--
-- Migration 002 enabled RLS on this table, but it was off in the live project:
-- an anonymous request with only the public anon key returned every row
-- (id, name, slug, status, created_at, updated_at). Re-enabling it is the fix;
-- the policies are re-asserted because disabling RLS often accompanies dropping them.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_member ON organizations;
CREATE POLICY organizations_select_member ON organizations
  FOR SELECT TO authenticated
  USING (is_platform_admin() OR is_active_organization_member(id));

DROP POLICY IF EXISTS organizations_manage_platform_admin ON organizations;
CREATE POLICY organizations_manage_platform_admin ON organizations
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- Re-assert RLS on every tenant table. These are no-ops where it is already on,
-- and they close the same gap if another table was switched off unnoticed.
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_payments ENABLE ROW LEVEL SECURITY;

-- A view has no RLS of its own. Without security_invoker it runs as its owner
-- and reads straight past the credit_accounts policies, exposing customer names
-- and outstanding balances across every tenant.
ALTER VIEW customer_debts SET (security_invoker = on);

-- Defence in depth. The browser bundle only ever calls supabase.auth.*; every
-- table read goes through the Express API using the service role key, which
-- bypasses RLS by design. Neither browser role needs table privileges at all,
-- so a future RLS slip stops being an instant data leak.
REVOKE ALL ON organizations, organization_memberships, categories, suppliers,
  products, movements, credit_accounts, credit_payments, customer_debts
  FROM anon, authenticated;


-- =====================================================================
-- PASO 10: Eliminar claves foraneas redundantes (PGRST201)
-- Origen: database/migrations/007_drop_redundant_foreign_keys.sql
-- =====================================================================

-- Fixes PostgREST error PGRST201, which broke every endpoint that embeds a
-- related table: the dashboard stats, the product list, the movement history
-- and the credit accounts.
--
-- Migration 003 added composite foreign keys on (id, organization_id) but left
-- the original single-column ones in place. PostgREST then sees two possible
-- relationships between the same pair of tables and refuses to guess.
--
-- Each composite key enforces everything its single-column counterpart did and
-- additionally requires both rows to belong to the same organization, and the
-- ON DELETE behaviour of each pair already matches, so dropping the older
-- constraint removes the ambiguity without weakening referential integrity.

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_category_id_fkey,
  DROP CONSTRAINT IF EXISTS products_supplier_id_fkey;

ALTER TABLE movements
  DROP CONSTRAINT IF EXISTS movements_product_id_fkey;

ALTER TABLE credit_accounts
  DROP CONSTRAINT IF EXISTS credit_accounts_product_id_fkey,
  DROP CONSTRAINT IF EXISTS credit_accounts_movement_id_fkey;

ALTER TABLE credit_payments
  DROP CONSTRAINT IF EXISTS credit_payments_credit_account_id_fkey;


-- =====================================================================
-- VERIFICACION FINAL
-- =====================================================================
-- Debe devolver 8 tablas, todas con rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('organizations','organization_memberships','categories',
                    'suppliers','products','movements','credit_accounts','credit_payments')
ORDER BY tablename;

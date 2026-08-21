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

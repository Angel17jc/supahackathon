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

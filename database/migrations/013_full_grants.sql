-- ============================================================================
-- Fix completo de permisos para ENVI Marketplace
-- Ejecutar en Supabase SQL Editor: https://supabase.com/dashboard/project/lhgvvionctkabjxuhtbw/sql/new
-- ============================================================================

-- 1. Categories: el vendedor necesita leer y gestionar sus propias categorías
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;

-- 2. Products: lectura completa (incluyendo cost_price para el vendedor)
--    La migración 009 solo concedió SELECT de columnas específicas (sin cost_price).
--    Necesitamos SELECT completo + INSERT/UPDATE/DELETE para CRUD de inventario.
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;

-- 3. Movements: lectura e inserción para registrar entradas/salidas
GRANT SELECT, INSERT ON movements TO authenticated;

-- 4. Organization memberships: necesario para /api/organizations/me
GRANT SELECT ON organization_memberships TO authenticated;

-- 5. Organizations: el vendedor necesita leer su propia tienda
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;

-- 6. Profiles: lectura y actualización del perfil propio
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- 7. Audit log: solo lectura (ya concedida en 009, reafirmar)
GRANT SELECT ON audit_log TO authenticated;

-- 8. Reservations: CRUD para apartados (ya concedido en 009, reafirmar)
GRANT SELECT, INSERT, UPDATE ON reservations TO authenticated;

-- 9. Stats views/tables que pueda haber
-- Si existe la tabla platform_audit_log
DO $$ BEGIN
  GRANT SELECT ON platform_audit_log TO authenticated;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

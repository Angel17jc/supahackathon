-- Convierte el panel de inventario de una sola tienda en un marketplace de
-- barrio: varias tiendas publican catálogo, cualquiera navega sin cuenta y la
-- sesión solo se exige para apartar un producto.
--
-- Es una migración destructiva. Elimina fiados y proveedores, que no existen en
-- un marketplace, y abre a usuarios anónimos una parte del catálogo que hasta
-- ahora estaba cerrada por completo.
--
-- Ejecutar después de 008 (o de database/bootstrap.sql) y una sola vez.
--
-- Todo va dentro de una transacción. El DDL de Postgres es transaccional, así
-- que un fallo a mitad deja la base exactamente como estaba en vez de dejarla
-- sin fiados pero tampoco con apartados.

BEGIN;

-- =====================================================================
-- 1. Retirar lo que no pertenece a un marketplace
-- =====================================================================
-- El fiado es de tienda de barrio con clientes conocidos: no tiene sentido
-- entre desconocidos que se encuentran en una vitrina pública.

DROP TABLE IF EXISTS credit_payments CASCADE;
DROP TABLE IF EXISTS credit_accounts CASCADE;
DROP VIEW IF EXISTS customer_debts;

DROP FUNCTION IF EXISTS create_credit_sale(UUID, INTEGER, TEXT, INTEGER, TEXT, UUID);
DROP FUNCTION IF EXISTS register_credit_payment(UUID, INTEGER, NUMERIC, VARCHAR, TEXT);

-- En un marketplace la tienda es el proveedor, así que la tabla sobra. La clave
-- foránea compuesta se retira antes que la columna porque la referencia (id,
-- organization_id) impide eliminar suppliers mientras exista.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_supplier_organization_fkey;
ALTER TABLE products DROP COLUMN IF EXISTS supplier_id;
DROP TABLE IF EXISTS suppliers CASCADE;

-- =====================================================================
-- 2. Vitrina: separar el borrador de lo publicado
-- =====================================================================
-- Un producto existe en el inventario de la tienda desde que se crea, pero solo
-- aparece en la vitrina cuando su dueño lo decide. Sin esta separación, abrir el
-- catálogo publicaría también los borradores.

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_published
  ON products(organization_id) WHERE is_published;

COMMENT ON COLUMN products.is_published IS
  'Visible en la vitrina pública. Los borradores solo los ve su tienda.';

-- Los datos que ya existían son el catálogo de arranque de la demo.
UPDATE products SET is_published = TRUE WHERE is_published = FALSE;

-- =====================================================================
-- 3. Compradores
-- =====================================================================
-- El modelo actual asume que todo usuario pertenece a una organización. Un
-- comprador no pertenece a ninguna, así que su identidad vive aparte y su rol
-- se deduce: quien no tiene membresía activa es comprador.

CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_full_name_not_blank CHECK (length(trim(full_name)) > 0)
);

COMMENT ON TABLE profiles IS 'Datos visibles de cualquier usuario, tenga tienda o no';

CREATE OR REPLACE FUNCTION is_seller()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid() AND status = 'active'
  );
$$;

COMMENT ON FUNCTION is_seller() IS
  'Vendedor es quien tiene una membresía activa. No hay columna de rol que mantener en sincronía.';

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_platform_admin());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =====================================================================
-- 4. Apartados: la política por fila con dos titulares
-- =====================================================================
-- Cada fila tiene dos dueños legítimos y ninguno más: el comprador que la creó
-- y la tienda dueña del producto. No es aislamiento por tenant, donde una fila
-- pertenece a un solo lado; aquí la misma fila se alcanza por dos caminos
-- distintos y hay que cerrar todos los demás.

CREATE TABLE IF NOT EXISTS reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      INTEGER NOT NULL,
  organization_id UUID    NOT NULL,
  buyer_id        UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reservations_positive_quantity CHECK (quantity > 0),
  -- La clave compuesta impide inventar la tienda: el par (producto, tienda)
  -- tiene que existir tal cual en products, así que un cliente no puede
  -- atribuir su apartado a una tienda que no vende ese producto.
  CONSTRAINT reservations_product_organization_fkey
    FOREIGN KEY (product_id, organization_id)
    REFERENCES products(id, organization_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reservations_buyer ON reservations(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservations_organization ON reservations(organization_id, created_at DESC);

DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_organizations_updated_at();

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- El comprador ve las suyas, de cualquier tienda.
DROP POLICY IF EXISTS reservations_select_buyer ON reservations;
CREATE POLICY reservations_select_buyer ON reservations
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

-- La tienda ve las de sus productos, de cualquier comprador.
DROP POLICY IF EXISTS reservations_select_seller ON reservations;
CREATE POLICY reservations_select_seller ON reservations
  FOR SELECT TO authenticated
  USING (is_active_organization_member(organization_id));

-- Apartar en nombre de otro es el ataque obvio, y WITH CHECK lo cierra en la
-- base: buyer_id no se acepta del cliente, se compara contra el token.
DROP POLICY IF EXISTS reservations_insert_own ON reservations;
CREATE POLICY reservations_insert_own ON reservations
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM products
      WHERE products.id = reservations.product_id
        AND products.organization_id = reservations.organization_id
        AND products.is_published
    )
  );

-- El comprador solo puede cancelar; el resto de estados los decide la tienda.
DROP POLICY IF EXISTS reservations_update_buyer_cancel ON reservations;
CREATE POLICY reservations_update_buyer_cancel ON reservations
  FOR UPDATE TO authenticated
  USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() AND status = 'cancelled');

DROP POLICY IF EXISTS reservations_update_seller ON reservations;
CREATE POLICY reservations_update_seller ON reservations
  FOR UPDATE TO authenticated
  USING (is_active_organization_member(organization_id))
  WITH CHECK (is_active_organization_member(organization_id));

-- =====================================================================
-- 5. Auditoría append-only
-- =====================================================================
-- Un registro que se puede reescribir no es un registro. El trigger se dispara
-- antes que cualquier permiso de tabla, así que ni la clave de servicio, que
-- salta RLS por diseño, consigue modificar una línea ya escrita.

CREATE TABLE IF NOT EXISTS audit_log (
  id              BIGSERIAL PRIMARY KEY,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id        UUID,
  actor_email     TEXT,
  organization_id UUID,
  action          TEXT NOT NULL,
  resource        TEXT NOT NULL,
  resource_id     TEXT,
  outcome         VARCHAR(10) NOT NULL CHECK (outcome IN ('allowed', 'denied')),
  detail          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_log_recent ON audit_log(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_denied ON audit_log(occurred_at DESC) WHERE outcome = 'denied';

COMMENT ON COLUMN audit_log.outcome IS
  'allowed o denied. Los intentos rechazados son la parte interesante.';

CREATE OR REPLACE FUNCTION audit_log_reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log es append-only: % no esta permitido', TG_OP
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();

-- Un DELETE fila a fila se bloquea arriba, pero TRUNCATE no dispara triggers de
-- fila y vaciaría la tabla entera sin dejar rastro.
DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_reject_mutation();

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_own ON audit_log;
CREATE POLICY audit_log_select_own ON audit_log
  FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR actor_id = auth.uid()
    OR (organization_id IS NOT NULL AND is_active_organization_member(organization_id))
  );

-- =====================================================================
-- 6. Abrir la vitrina sin abrir el margen
-- =====================================================================
-- La migración 006 revocó todo privilegio a anon y authenticated: hoy ninguna
-- lectura directa desde el navegador funciona. Un marketplace necesita lo
-- contrario para el catálogo, y solo para el catálogo.
--
-- cost_price es el precio al que la tienda compró. Filtrado, un competidor sabe
-- exactamente cuánto bajar para hundirla. RLS filtra filas, no columnas, así que
-- una política no basta: el privilegio se concede columna por columna.
--
-- Los vendedores sí necesitan su propio cost_price, y lo leen por la API con la
-- clave de servicio, que no pasa por estos GRANT. El navegador nunca lo ve.

GRANT SELECT (
  id, name, description, sku, quantity, selling_price,
  category_id, image_url, min_stock_level, organization_id, is_published
) ON products TO anon, authenticated;

DROP POLICY IF EXISTS products_select_published ON products;
CREATE POLICY products_select_published ON products
  FOR SELECT TO anon, authenticated
  USING (is_published);

-- Nombres de categoría y de tienda: sin ellos la vitrina no se puede leer, y no
-- revelan nada que el propio catálogo no muestre ya.
GRANT SELECT (id, name, description, organization_id) ON categories TO anon, authenticated;

DROP POLICY IF EXISTS categories_select_public ON categories;
CREATE POLICY categories_select_public ON categories
  FOR SELECT TO anon, authenticated
  USING (TRUE);

GRANT SELECT (id, name, slug, status) ON organizations TO anon, authenticated;

DROP POLICY IF EXISTS organizations_select_public ON organizations;
CREATE POLICY organizations_select_public ON organizations
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- Apartados y auditoría: el privilegio es de tabla completa porque lo que
-- protege cada fila son las políticas de arriba, no el conjunto de columnas.
-- Así una lectura ajena devuelve cero filas en lugar de un error de permisos,
-- que es exactamente lo que hay que enseñar: RLS filtrando, no un portón.
GRANT SELECT, INSERT, UPDATE ON reservations TO authenticated;
GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT, UPDATE ON profiles TO authenticated;

-- =====================================================================
-- 7. Storage: cada tienda escribe solo en su carpeta
-- =====================================================================
-- Las imágenes van a {organization_id}/{product_id}/{archivo}. Poner el
-- identificador de la tienda como primer segmento permite reutilizar la misma
-- función de membresía que protege las tablas, en vez de inventar un segundo
-- concepto de pertenencia que habría que mantener en sincronía.

INSERT INTO storage.buckets (id, name, public)
VALUES ('productos', 'productos', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

-- foldername devuelve texto y el primer segmento puede ser cualquier cosa que
-- alguien escriba en la ruta. Un cast directo a uuid aborta la consulta entera
-- con error de sintaxis en vez de denegar, así que se valida antes.
CREATE OR REPLACE FUNCTION storage_object_organization(object_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  first_segment TEXT;
BEGIN
  first_segment := (storage.foldername(object_name))[1];
  IF first_segment IS NULL THEN
    RETURN NULL;
  END IF;
  IF first_segment !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN first_segment::UUID;
END;
$$;

DROP POLICY IF EXISTS productos_read_public ON storage.objects;
CREATE POLICY productos_read_public ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'productos');

DROP POLICY IF EXISTS productos_write_own_folder ON storage.objects;
CREATE POLICY productos_write_own_folder ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'productos'
    AND is_active_organization_member(storage_object_organization(name))
  );

DROP POLICY IF EXISTS productos_update_own_folder ON storage.objects;
CREATE POLICY productos_update_own_folder ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'productos' AND is_active_organization_member(storage_object_organization(name)))
  WITH CHECK (bucket_id = 'productos' AND is_active_organization_member(storage_object_organization(name)));

DROP POLICY IF EXISTS productos_delete_own_folder ON storage.objects;
CREATE POLICY productos_delete_own_folder ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'productos' AND is_active_organization_member(storage_object_organization(name)));

COMMIT;

-- =====================================================================
-- Verificación
-- =====================================================================
-- Las tablas de fiados y proveedores ya no aparecen; sí las tres nuevas
-- (profiles, reservations, audit_log), todas con RLS activo.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

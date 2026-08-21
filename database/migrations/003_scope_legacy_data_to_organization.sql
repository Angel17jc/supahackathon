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

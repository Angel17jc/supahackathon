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

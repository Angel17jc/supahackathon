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

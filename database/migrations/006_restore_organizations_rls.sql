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

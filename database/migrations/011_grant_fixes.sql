-- Fix: authenticated role needs SELECT on organization_memberships for /api/organizations/me
-- and SELECT on categories for catalog browsing.

GRANT SELECT ON organization_memberships TO authenticated;
GRANT SELECT ON categories TO authenticated;

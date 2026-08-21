-- Fix: authenticated role needs access to inventory tables
-- The migration 006 revoked all grants; these restore what the frontend needs.

-- Products: authenticated needs full read for inventory pages
GRANT SELECT ON products TO authenticated;

-- Movements: authenticated needs read for movements page
GRANT SELECT ON movements TO authenticated;

-- Categories: already granted in 011 but confirm
GRANT SELECT ON categories TO authenticated;

-- organization_memberships: needed for /api/organizations/me
GRANT SELECT ON organization_memberships TO authenticated;

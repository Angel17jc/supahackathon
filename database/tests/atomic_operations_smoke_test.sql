-- Manual smoke test for 005_atomic_inventory_operations.sql.
-- It never persists data: every change is rolled back at the end.

BEGIN;

DO $$
DECLARE
  test_organization_id UUID;
  test_product_id INTEGER;
  original_quantity INTEGER;
  final_quantity INTEGER;
BEGIN
  SELECT organization_id, id, quantity
  INTO test_organization_id, test_product_id, original_quantity
  FROM products
  ORDER BY id
  LIMIT 1;

  IF test_product_id IS NULL THEN
    RAISE EXCEPTION 'Smoke test requires at least one product';
  END IF;

  PERFORM create_inventory_movement(
    test_organization_id,
    test_product_id,
    'IN',
    1,
    'Atomic operation smoke test',
    NULL
  );

  SELECT quantity INTO final_quantity
  FROM products
  WHERE id = test_product_id AND organization_id = test_organization_id;
  IF final_quantity <> original_quantity + 1 THEN
    RAISE EXCEPTION 'Expected stock %, got %', original_quantity + 1, final_quantity;
  END IF;

  BEGIN
    PERFORM create_inventory_movement(
      test_organization_id,
      test_product_id,
      'OUT',
      final_quantity + 1,
      'Insufficient stock smoke test',
      NULL
    );
    RAISE EXCEPTION 'Expected insufficient-stock validation to fail';
  EXCEPTION WHEN SQLSTATE '22000' THEN
    NULL;
  END;
END;
$$;

ROLLBACK;

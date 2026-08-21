-- Run after the tenant migrations. These functions are API-only operations:
-- they serialize concurrent changes with row locks and keep inventory history
-- and balances in one PostgreSQL transaction.

CREATE OR REPLACE FUNCTION create_inventory_movement(
  p_organization_id UUID,
  p_product_id INTEGER,
  p_type VARCHAR,
  p_quantity INTEGER,
  p_reason TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF movements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity INTEGER;
  resulting_quantity INTEGER;
BEGIN
  IF p_type NOT IN ('IN', 'OUT', 'ADJUSTMENT') THEN
    RAISE EXCEPTION 'Invalid movement type' USING ERRCODE = '22023';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Movement quantity must be greater than zero' USING ERRCODE = '22023';
  END IF;

  SELECT quantity INTO current_quantity
  FROM products
  WHERE id = p_product_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in organization' USING ERRCODE = 'P0002';
  END IF;

  resulting_quantity := CASE
    WHEN p_type = 'IN' THEN current_quantity + p_quantity
    WHEN p_type = 'OUT' THEN current_quantity - p_quantity
    ELSE p_quantity
  END;
  IF resulting_quantity < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, requested: %', current_quantity, p_quantity USING ERRCODE = '22000';
  END IF;

  UPDATE products
  SET quantity = resulting_quantity
  WHERE id = p_product_id AND organization_id = p_organization_id;

  RETURN QUERY
  INSERT INTO movements (organization_id, product_id, type, quantity, reason, user_id)
  VALUES (p_organization_id, p_product_id, p_type, p_quantity, p_reason, p_user_id::VARCHAR)
  RETURNING movements.*;
END;
$$;

CREATE OR REPLACE FUNCTION create_credit_sale(
  p_organization_id UUID,
  p_product_id INTEGER,
  p_customer_name TEXT,
  p_quantity INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS SETOF credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_quantity INTEGER;
  unit_price NUMERIC(10,2);
  movement_record movements;
  total NUMERIC(10,2);
BEGIN
  IF length(trim(p_customer_name)) = 0 OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Customer name and positive quantity are required' USING ERRCODE = '22023';
  END IF;

  SELECT quantity, selling_price INTO current_quantity, unit_price
  FROM products
  WHERE id = p_product_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found in organization' USING ERRCODE = 'P0002';
  END IF;
  IF current_quantity < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %, requested: %', current_quantity, p_quantity USING ERRCODE = '22000';
  END IF;

  UPDATE products SET quantity = quantity - p_quantity
  WHERE id = p_product_id AND organization_id = p_organization_id;

  INSERT INTO movements (organization_id, product_id, type, quantity, reason, user_id)
  VALUES (p_organization_id, p_product_id, 'OUT', p_quantity, 'Fiado a: ' || trim(p_customer_name), p_user_id::VARCHAR)
  RETURNING * INTO movement_record;

  total := unit_price * p_quantity;
  RETURN QUERY
  INSERT INTO credit_accounts (
    organization_id, customer_name, product_id, movement_id, quantity,
    unit_price, total_amount, paid_amount, remaining_amount, status, notes
  ) VALUES (
    p_organization_id, trim(p_customer_name), p_product_id, movement_record.id, p_quantity,
    unit_price, total, 0, total, 'pending', p_notes
  ) RETURNING credit_accounts.*;
END;
$$;

CREATE OR REPLACE FUNCTION register_credit_payment(
  p_organization_id UUID,
  p_credit_account_id INTEGER,
  p_amount NUMERIC(10,2),
  p_payment_method VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS SETOF credit_payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_record credit_accounts;
  next_remaining NUMERIC(10,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO account_record
  FROM credit_accounts
  WHERE id = p_credit_account_id AND organization_id = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit account not found in organization' USING ERRCODE = 'P0002';
  END IF;
  IF account_record.status = 'paid' OR p_amount > account_record.remaining_amount THEN
    RAISE EXCEPTION 'Payment exceeds the remaining balance' USING ERRCODE = '22000';
  END IF;

  next_remaining := account_record.remaining_amount - p_amount;
  UPDATE credit_accounts
  SET paid_amount = paid_amount + p_amount,
      remaining_amount = next_remaining,
      status = CASE WHEN next_remaining = 0 THEN 'paid' ELSE 'partial' END
  WHERE id = p_credit_account_id AND organization_id = p_organization_id;

  RETURN QUERY
  INSERT INTO credit_payments (organization_id, credit_account_id, amount, payment_method, notes)
  VALUES (p_organization_id, p_credit_account_id, p_amount, p_payment_method, p_notes)
  RETURNING credit_payments.*;
END;
$$;

REVOKE ALL ON FUNCTION create_inventory_movement(UUID, INTEGER, VARCHAR, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_credit_sale(UUID, INTEGER, TEXT, INTEGER, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION register_credit_payment(UUID, INTEGER, NUMERIC, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_inventory_movement(UUID, INTEGER, VARCHAR, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_credit_sale(UUID, INTEGER, TEXT, INTEGER, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION register_credit_payment(UUID, INTEGER, NUMERIC, VARCHAR, TEXT) TO service_role;

-- Tabla de cuentas de crédito (fiado)
CREATE TABLE IF NOT EXISTS credit_accounts (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_id INTEGER REFERENCES movements(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_quantity CHECK (quantity > 0),
  CONSTRAINT positive_amounts CHECK (
    unit_price >= 0 AND 
    total_amount >= 0 AND 
    paid_amount >= 0 AND 
    remaining_amount >= 0
  ),
  CONSTRAINT valid_amounts CHECK (total_amount = unit_price * quantity)
);

-- Tabla de pagos de crédito
CREATE TABLE IF NOT EXISTS credit_payments (
  id SERIAL PRIMARY KEY,
  credit_account_id INTEGER NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT positive_payment CHECK (amount > 0)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_credit_accounts_customer ON credit_accounts(customer_name);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_status ON credit_accounts(status);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_product ON credit_accounts(product_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_account ON credit_payments(credit_account_id);

-- Función para actualizar el timestamp de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar automáticamente updated_at
CREATE TRIGGER update_credit_accounts_updated_at 
  BEFORE UPDATE ON credit_accounts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Vista para resumen de deudas por cliente
CREATE OR REPLACE VIEW customer_debts AS
SELECT 
  customer_name,
  COUNT(*) as total_accounts,
  SUM(total_amount) as total_debt,
  SUM(paid_amount) as total_paid,
  SUM(remaining_amount) as total_remaining,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_accounts,
  COUNT(*) FILTER (WHERE status = 'partial') as partial_accounts,
  COUNT(*) FILTER (WHERE status = 'paid') as paid_accounts
FROM credit_accounts
GROUP BY customer_name;

COMMENT ON TABLE credit_accounts IS 'Cuentas de crédito para clientes que fían productos';
COMMENT ON TABLE credit_payments IS 'Pagos realizados a cuentas de crédito';
COMMENT ON COLUMN credit_accounts.status IS 'Estado: pending (sin pagar), partial (pago parcial), paid (pagado completo)';
COMMENT ON VIEW customer_debts IS 'Resumen de deudas agrupadas por cliente';

-- CashSession: exchange rate + USD fund
ALTER TABLE "cash_sessions"
  ADD COLUMN IF NOT EXISTS "exchangeRateUsdMxn"  DECIMAL(10,4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "openingAmountUsd"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cashCountedUsd"       DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "differenceUsd"        DECIMAL(10,2);

-- CashMovement: currency tracking
ALTER TABLE "cash_movements"
  ADD COLUMN IF NOT EXISTS "currency"               TEXT NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS "exchangeRateUsed"       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "amountOriginalCurrency" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "amountMxnEquivalent"    DECIMAL(10,2);

-- Payment: currency tracking
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "currency"               TEXT NOT NULL DEFAULT 'MXN',
  ADD COLUMN IF NOT EXISTS "exchangeRateUsed"       DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS "amountOriginalCurrency" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "amountMxnEquivalent"    DECIMAL(10,2);

-- Order: TC snapshot
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "exchangeRateUsed" DECIMAL(10,4);

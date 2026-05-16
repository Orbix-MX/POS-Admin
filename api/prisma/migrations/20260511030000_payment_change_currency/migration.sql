-- Add changeCurrency to payments for change-out audit trail
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "changeCurrency" TEXT;

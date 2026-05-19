-- Normalises CashMovementType and adds cash_session linkage columns.
-- Runs AFTER 20260505021314 (which creates CashMovementType as
-- 'SUPPLIER_PAYMENT','INGRESO_MANUAL','EGRESO_MANUAL' and the cash_movements
-- table). This is the logic that originally lived in 20260504203846 but could
-- never replay there because the type/table did not exist yet.

-- Rename legacy values to the canonical ones (guarded for idempotency)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'CashMovementType' AND e.enumlabel = 'INGRESO_MANUAL') THEN
    ALTER TYPE "CashMovementType" RENAME VALUE 'INGRESO_MANUAL' TO 'INCOME';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'CashMovementType' AND e.enumlabel = 'EGRESO_MANUAL') THEN
    ALTER TYPE "CashMovementType" RENAME VALUE 'EGRESO_MANUAL' TO 'EXPENSE';
  END IF;
END $$;

-- Add the new values
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'SALE';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CXC_PAYMENT';

-- AlterTable cash_movements: add cash-session linkage columns
ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "cashSessionId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "referenceType" TEXT;

-- AddForeignKey cash_movements.cashSessionId -> cash_sessions.id
DO $$ BEGIN
  ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

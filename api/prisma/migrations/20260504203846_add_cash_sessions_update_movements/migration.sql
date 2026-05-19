-- NOTE: This migration originally also renamed CashMovementType values and
-- altered cash_movements, but those objects are not created until the later
-- migration 20260505021314. That made the chain impossible to replay on a
-- fresh database. The enum/cash_movements changes were moved to the new
-- migration 20260505030000_normalize_cash_movement_type which runs AFTER
-- 20260505021314. This migration now only creates cash_sessions, whose
-- dependencies (tenants/branches/users) already exist at this point.

-- CreateEnum CashSessionStatus
DO $$ BEGIN
  CREATE TYPE "CashSessionStatus" AS ENUM ('ABIERTA', 'CERRADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable cash_sessions
CREATE TABLE IF NOT EXISTS "cash_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'ABIERTA',
    "openingAmount" DECIMAL(10,2) NOT NULL,
    "closingAmount" DECIMAL(10,2),
    "cashCounted" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "notes" TEXT,
    "openedById" TEXT,
    "closedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_sessions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey cash_sessions
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

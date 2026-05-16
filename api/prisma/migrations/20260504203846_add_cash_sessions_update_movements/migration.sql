-- Rename existing CashMovementType values
ALTER TYPE "CashMovementType" RENAME VALUE 'INGRESO_MANUAL' TO 'INCOME';
ALTER TYPE "CashMovementType" RENAME VALUE 'EGRESO_MANUAL' TO 'EXPENSE';

-- Add new CashMovementType values
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'SALE';
ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'CXC_PAYMENT';

-- CreateEnum CashSessionStatus
CREATE TYPE "CashSessionStatus" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateTable cash_sessions
CREATE TABLE "cash_sessions" (
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

-- AlterTable cash_movements: add new columns
ALTER TABLE "cash_movements" ADD COLUMN "cashSessionId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "referenceId" TEXT;
ALTER TABLE "cash_movements" ADD COLUMN "referenceType" TEXT;

-- AddForeignKey cash_sessions
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey cash_movements.cashSessionId
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

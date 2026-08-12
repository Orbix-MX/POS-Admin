-- Fase 8 de docs/AUDITORIA-CAJA.md — caja física, reembolsos y nombres.
--
-- Matriz #1: no existía CashRegister, así que una sucursal solo podía tener una
--            caja. La sesión hacía de caja, y su `openedById` sugería una
--            pertenencia que el sistema no aplicaba.
-- CASH-013:  los reembolsos se tipaban EXPENSE y el corte los mostraba como
--            "egresos manuales"; y `closingAmount` guardaba el esperado.

ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'REFUND';

CREATE TABLE "cash_registers" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "branchId"  TEXT,
    "name"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_registers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_registers_tenantId_branchId_name_key"
  ON "cash_registers"("tenantId", "branchId", "name");
CREATE INDEX "cash_registers_tenantId_branchId_isActive_idx"
  ON "cash_registers"("tenantId", "branchId", "isActive");

ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_registers" ADD CONSTRAINT "cash_registers_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Renombre: la columna guardaba el efectivo *esperado*, no el de cierre.
ALTER TABLE "cash_sessions" RENAME COLUMN "closingAmount" TO "expectedAmount";

ALTER TABLE "cash_sessions" ADD COLUMN "cashRegisterId" TEXT;

-- Backfill: cada combinación (tenant, sucursal) con historial recibe su "Caja 1"
-- y todas sus sesiones quedan colgando de ella. Así el histórico no pierde
-- continuidad y la restricción de una caja viva sigue aplicando desde el día uno.
WITH combos AS (
  SELECT DISTINCT "tenantId", "branchId" FROM "cash_sessions"
), creadas AS (
  INSERT INTO "cash_registers" ("id", "tenantId", "branchId", "name", "isActive", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), c."tenantId", c."branchId", 'Caja 1', true, now(), now()
  FROM combos c
  RETURNING "id", "tenantId", "branchId"
)
UPDATE "cash_sessions" s
SET "cashRegisterId" = r."id"
FROM creadas r
WHERE s."tenantId" = r."tenantId"
  AND s."branchId" IS NOT DISTINCT FROM r."branchId";

ALTER TABLE "cash_sessions" ALTER COLUMN "cashRegisterId" SET NOT NULL;

ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_cashRegisterId_fkey"
  FOREIGN KEY ("cashRegisterId") REFERENCES "cash_registers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

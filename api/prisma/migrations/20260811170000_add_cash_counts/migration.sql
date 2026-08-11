-- Fase 4 de docs/AUDITORIA-CAJA.md — arqueo formal y diferencias explicables.
--
-- CASH-006: el arqueo eran dos columnas de la sesión (un único conteo, sin
--           motivo). Pasa a entidad con cardinalidad N por sesión, porque el
--           negocio puede requerir varios arqueos en un mismo día: corte por
--           turno o recuento tras una diferencia.

CREATE TYPE "CashCountType" AS ENUM ('PARCIAL', 'FINAL');

-- Justificación de la diferencia del cierre.
ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "differenceReason" TEXT;

CREATE TABLE "cash_counts" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "cashSessionId"  TEXT NOT NULL,
    "type"           "CashCountType" NOT NULL DEFAULT 'PARCIAL',
    "countedMxn"     DECIMAL(10,2) NOT NULL,
    "countedUsd"     DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expectedMxn"    DECIMAL(10,2) NOT NULL,
    "expectedUsd"    DECIMAL(10,2) NOT NULL DEFAULT 0,
    "differenceMxn"  DECIMAL(10,2) NOT NULL,
    "differenceUsd"  DECIMAL(10,2) NOT NULL DEFAULT 0,
    "denominations"  JSONB,
    "reason"         TEXT,
    "countedById"    TEXT,
    "authorizedById" TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_counts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cash_counts_tenantId_cashSessionId_createdAt_idx"
  ON "cash_counts"("tenantId", "cashSessionId", "createdAt");

ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrict: un arqueo es evidencia; borrar la sesión no debe borrarlo en silencio.
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_countedById_fkey"
  FOREIGN KEY ("countedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_authorizedById_fkey"
  FOREIGN KEY ("authorizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

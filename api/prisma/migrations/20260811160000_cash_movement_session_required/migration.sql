-- Fase 1 de docs/AUDITORIA-CAJA.md — integridad del libro mayor de caja.
--
-- CASH-001: `cashSessionId` pasa a NOT NULL. Los cobros de CxC, pagos a
--           proveedor y movimientos manuales sin caja abierta se guardaban
--           huérfanos: dinero real que no aparecía en ningún corte.
-- CASH-013: la FK pasa de SET NULL a RESTRICT (borrar una sesión ya no
--           huérfana sus movimientos en silencio) y se indexa la consulta
--           del corte.

-- 1. Rescate de huérfanos.
--
--    No se borran ni se adjuntan a una sesión existente: atribuirlos a una caja
--    que no los contuvo falsificaría un corte ya cerrado, que es justamente lo
--    que la auditoría condena. En su lugar cada tenant afectado recibe una
--    sesión de regularización, cerrada y rotulada, que los hace visibles y
--    auditables sin tocar el historial real.
WITH tenants_con_huerfanos AS (
  SELECT DISTINCT "tenantId"
  FROM "cash_movements"
  WHERE "cashSessionId" IS NULL
), sesiones_creadas AS (
  INSERT INTO "cash_sessions" (
    "id", "tenantId", "branchId", "status", "exchangeRateUsdMxn",
    "openingAmount", "openingAmountUsd", "notes",
    "openedAt", "closedAt", "createdAt", "updatedAt"
  )
  SELECT
    gen_random_uuid(),
    t."tenantId",
    NULL,
    'CERRADA'::"CashSessionStatus",
    1,
    0,
    0,
    'Sesión de regularización (migración cash_movement_session_required). Agrupa movimientos que quedaron sin sesión por el defecto CASH-001. No corresponde a una caja física y su diferencia no es un faltante real.',
    now(), now(), now(), now()
  FROM tenants_con_huerfanos t
  RETURNING "id", "tenantId"
)
UPDATE "cash_movements" m
SET "cashSessionId" = s."id"
FROM sesiones_creadas s
WHERE m."tenantId" = s."tenantId"
  AND m."cashSessionId" IS NULL;

-- 2. La columna deja de admitir nulos.
ALTER TABLE "cash_movements" ALTER COLUMN "cashSessionId" SET NOT NULL;

-- 3. FK con RESTRICT en lugar de SET NULL.
ALTER TABLE "cash_movements" DROP CONSTRAINT IF EXISTS "cash_movements_cashSessionId_fkey";
ALTER TABLE "cash_movements"
  ADD CONSTRAINT "cash_movements_cashSessionId_fkey"
  FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Índice para el corte: agrega por sesión y tipo.
CREATE INDEX IF NOT EXISTS "cash_movements_tenantId_cashSessionId_type_idx"
  ON "cash_movements"("tenantId", "cashSessionId", "type");

-- Fases 5 y 6 de docs/AUDITORIA-CAJA.md — retiro, corte parcial y multi-moneda.
--
-- CASH-005: el retiro no existía como concepto. Se agrega como tipo de
--           movimiento (no tabla aparte: un solo libro mayor) más el fondo
--           restante, que encadena con la apertura siguiente.
-- CASH-011: sin estados intermedios no podía representarse "arqueo hecho, caja
--           todavía abierta" ni "cierre pendiente de autorización".

ALTER TYPE "CashMovementType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';

ALTER TYPE "CashSessionStatus" ADD VALUE IF NOT EXISTS 'EN_ARQUEO' AFTER 'ABIERTA';
ALTER TYPE "CashSessionStatus" ADD VALUE IF NOT EXISTS 'PENDIENTE_REVISION' AFTER 'EN_ARQUEO';

ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "remainingFund" DECIMAL(10,2);
ALTER TABLE "cash_sessions" ADD COLUMN IF NOT EXISTS "remainingFundUsd" DECIMAL(10,2);

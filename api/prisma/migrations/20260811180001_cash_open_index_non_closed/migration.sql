-- Continuación de 20260811180000 (migración separada: Postgres no permite usar
-- un valor de enum recién agregado dentro de la misma transacción que lo creó).
--
-- El índice que garantiza "una sola caja viva por sucursal" cubría solo ABIERTA.
-- Con los estados intermedios, una sesión EN_ARQUEO dejaba de bloquear y podía
-- abrirse una segunda caja sobre la misma sucursal. Ahora cubre todo lo que no
-- esté CERRADA.
DROP INDEX IF EXISTS "cash_sessions_one_open_per_branch_key";

CREATE UNIQUE INDEX "cash_sessions_one_open_per_branch_key"
ON "cash_sessions" ("tenantId", COALESCE("branchId", ''))
WHERE status <> 'CERRADA';

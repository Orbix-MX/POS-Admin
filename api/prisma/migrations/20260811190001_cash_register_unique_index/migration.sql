-- Continuación: la unicidad de "caja viva" pasa de la sucursal a la caja física.
-- Con varias cajas por sucursal, restringir por sucursal impediría abrir la
-- Caja 2 mientras la Caja 1 opera.
DROP INDEX IF EXISTS "cash_sessions_one_open_per_branch_key";

CREATE UNIQUE INDEX "cash_sessions_one_open_per_register_key"
ON "cash_sessions" ("cashRegisterId")
WHERE status <> 'CERRADA';

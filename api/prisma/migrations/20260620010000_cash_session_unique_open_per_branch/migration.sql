-- Garantiza que una sucursal tenga a lo sumo UNA sesión de caja ABIERTA a nivel
-- de base de datos. Inmune a la race condition del check-then-create en open():
-- dos operadores abriendo a la vez no pueden insertar dos sesiones ABIERTA para
-- la misma sucursal — la segunda viola el índice único.

-- 1. Remediación de datos preexistentes.
--    Si ya existieran varias sesiones ABIERTA para una misma (tenant, sucursal),
--    conservar UNA y cerrar el resto (de lo contrario el índice único no podría
--    crearse). Criterio: conservar la de más movimientos y, a igualdad, la más
--    antigua; las demás pasan a CERRADA.
WITH ranked AS (
  SELECT s.id,
         row_number() OVER (
           PARTITION BY s."tenantId", COALESCE(s."branchId", '')
           ORDER BY (SELECT count(*) FROM "cash_movements" m WHERE m."cashSessionId" = s.id) DESC,
                    s."openedAt" ASC
         ) AS rn
  FROM "cash_sessions" s
  WHERE s.status = 'ABIERTA'
)
UPDATE "cash_sessions" c
SET status = 'CERRADA',
    "closedAt" = now(),
    notes = COALESCE(c.notes || ' — ', '') || 'Cerrada automáticamente: sesión abierta duplicada (migración).'
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 2. Índice único parcial: a lo sumo una sesión ABIERTA por (tenant, sucursal).
--    COALESCE normaliza branchId NULL a '' para que dos sesiones sin sucursal del
--    mismo tenant también colisionen (en un índice único los NULL serían
--    distintos y dejarían pasar duplicados).
CREATE UNIQUE INDEX "cash_sessions_one_open_per_branch_key"
ON "cash_sessions" ("tenantId", COALESCE("branchId", ''))
WHERE status = 'ABIERTA';

-- Garantiza que una mesa tenga a lo sumo UNA cuenta activa (DiningOrder no
-- terminal) a nivel de base de datos. Inmune a la race condition del check-then-
-- create en la aplicación: dos requests simultáneos no pueden insertar dos
-- cuentas activas para la misma mesa — la segunda viola el índice único.

-- 1. Remediación de datos preexistentes.
--    Si por la race condition ya existieran varias cuentas activas para la misma
--    mesa, conservar UNA sola y cancelar el resto (de lo contrario el índice
--    único no podría crearse). Criterio: conservar la de mayor número de
--    productos y, a igualdad, la más antigua (la cuenta original); las demás
--    pasan a CANCELLED. Así "únicamente una orden sobrevive".
WITH ranked AS (
  SELECT o.id,
         row_number() OVER (
           PARTITION BY o."tableId"
           ORDER BY (SELECT count(*) FROM "dining_order_items" i WHERE i."orderId" = o.id) DESC,
                    o."openedAt" ASC
         ) AS rn
  FROM "dining_orders" o
  WHERE o."tableId" IS NOT NULL
    AND o.status NOT IN ('PAID', 'CLOSED', 'CANCELLED')
)
UPDATE "dining_orders" d
SET status = 'CANCELLED', "closedAt" = now()
FROM ranked r
WHERE d.id = r.id AND r.rn > 1;

-- 2. Índice único parcial: a lo sumo una cuenta activa por mesa.
--    Estados activos = todos menos los terminales (PAID/CLOSED/CANCELLED), lo que
--    cubre OPEN, SENT_TO_KITCHEN, IN_PREPARATION, READY, DELIVERED y
--    READY_FOR_PAYMENT. Una mesa vuelve a admitir cuenta nueva solo cuando la
--    anterior queda PAID, CLOSED o CANCELLED.
CREATE UNIQUE INDEX "dining_orders_active_table_key"
ON "dining_orders" ("tableId")
WHERE "tableId" IS NOT NULL
  AND status NOT IN ('PAID', 'CLOSED', 'CANCELLED');

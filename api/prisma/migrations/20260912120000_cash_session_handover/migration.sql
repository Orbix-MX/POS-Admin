-- Bitácora de quién estuvo delante del cajón abierto.
--
-- `cash_sessions` solo nombra a dos personas (opened_by_id / closed_by_id) y el
-- dominio admite que sean distintas: un relevo de turno entra en la misma
-- terminal y continúa la sesión. Con tres cajeros en un turno largo, el de en
-- medio no aparecía en el corte.
--
-- `left_at` NULL significa "seguía dentro", nunca "salió a tal hora": en un
-- móvil la señal de salida no es fiable, así que el tramo lo cierra la entrada
-- del siguiente o el cierre de la sesión.
CREATE TABLE "cash_session_handovers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "userId" TEXT,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_session_handovers_pkey" PRIMARY KEY ("id")
);

-- El corte lee los tramos de una sesión en orden de entrada.
CREATE INDEX "cash_session_handovers_tenantId_cashSessionId_enteredAt_idx"
    ON "cash_session_handovers"("tenantId", "cashSessionId", "enteredAt");

ALTER TABLE "cash_session_handovers"
    ADD CONSTRAINT "cash_session_handovers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Restrict, como en cash_movements: borrar una sesión dejaría tramos huérfanos.
ALTER TABLE "cash_session_handovers"
    ADD CONSTRAINT "cash_session_handovers_cashSessionId_fkey"
    FOREIGN KEY ("cashSessionId") REFERENCES "cash_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SetNull: dar de baja a una persona no borra que estuvo en la caja.
ALTER TABLE "cash_session_handovers"
    ADD CONSTRAINT "cash_session_handovers_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

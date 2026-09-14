-- Verificación de teléfono por SMS.
--
-- Solo el hash del código se guarda, nunca el código. `attempts` cierra el
-- intento tras unos pocos fallos: seis dígitos se adivinan por fuerza bruta si
-- nadie cuenta los intentos.
CREATE TABLE "phone_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_verifications_userId_idx" ON "phone_verifications"("userId");

-- El índice por (teléfono, fecha) es lo que hace barato el límite por número:
-- sin él, cada envío escanearía la tabla entera.
CREATE INDEX "phone_verifications_phone_created_at_idx" ON "phone_verifications"("phone", "created_at");

ALTER TABLE "phone_verifications"
  ADD CONSTRAINT "phone_verifications_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

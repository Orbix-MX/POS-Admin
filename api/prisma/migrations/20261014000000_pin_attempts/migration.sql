-- Contador de intentos fallidos de PIN, por quien los hace (dispositivo o sesión de usuario).
--
-- Migración aditiva (expand): tabla y tipo nuevos, no toca datos existentes. La clave
-- (scope, scope_key) es polimórfica -deviceId o userId- por eso no lleva FK.
CREATE TYPE "PinAttemptScope" AS ENUM ('DEVICE', 'USER');

CREATE TABLE "pin_attempts" (
    "id" TEXT NOT NULL,
    "scope" "PinAttemptScope" NOT NULL,
    "scope_key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pin_attempts_pkey" PRIMARY KEY ("id")
);

-- Una fila por principal; también es el índice del ON CONFLICT del incremento atómico.
CREATE UNIQUE INDEX "pin_attempts_scope_scope_key_key" ON "pin_attempts"("scope", "scope_key");

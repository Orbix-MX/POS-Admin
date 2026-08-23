-- Bloqueo de cuenta por intentos fallidos.
-- El throttling por IP no frena un ataque lento y distribuido contra una cuenta
-- concreta; estos campos acotan los intentos por cuenta.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP(3);

-- Vínculo opcional entre un empleado y su cuenta de back-office.
-- Nullable a propósito: la mayoría del personal opera solo con PIN.
ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- SetNull: si la cuenta desaparece, el expediente del empleado permanece.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_user_id_fkey'
  ) THEN
    ALTER TABLE "employees"
      ADD CONSTRAINT "employees_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Una cuenta no puede estar vinculada a dos empleados del mismo tenant.
-- El índice único ignora los NULL, así que no estorba al personal sin cuenta.
CREATE UNIQUE INDEX IF NOT EXISTS "employees_tenantId_user_id_key"
  ON "employees"("tenantId", "user_id");

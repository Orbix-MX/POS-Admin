-- Autorización por PIN de empleado en arqueo y corte desde el POS.
ALTER TABLE "cash_sessions" ADD COLUMN "authorized_by_employee_id" TEXT;

ALTER TABLE "cash_sessions"
  ADD CONSTRAINT "cash_sessions_authorized_by_employee_id_fkey"
  FOREIGN KEY ("authorized_by_employee_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

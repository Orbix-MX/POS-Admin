-- Tope de sesiones de caja simultáneas por sucursal, override por tenant.
ALTER TABLE "tenants" ADD COLUMN "cash_session_limit_override" INTEGER;

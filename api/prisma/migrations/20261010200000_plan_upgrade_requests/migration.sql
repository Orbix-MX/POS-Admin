-- Solicitudes de "Mejorar plan" desde la app (S-E del alta self-service).
--
-- Sin cobro: Platform las atiende a mano. `handled_by_id` guarda el PlatformUser que
-- la atendió y no es FK, porque los usuarios de Platform viven en su propia tabla.
CREATE TYPE "PlanUpgradeRequestStatus" AS ENUM ('PENDING', 'HANDLED', 'CANCELLED');

CREATE TABLE "plan_upgrade_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "current_plan" "TenantPlan" NOT NULL,
    "requested_plan" "TenantPlan" NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "note" TEXT,
    "status" "PlanUpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "handled_by_id" TEXT,
    "handled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- (empresa, estado): buscar la pendiente de una empresa al pedir otra vez.
CREATE INDEX "plan_upgrade_requests_tenant_id_status_idx" ON "plan_upgrade_requests"("tenant_id", "status");

-- (estado, fecha): la bandeja de Platform, pendientes de la más antigua a la más nueva.
CREATE INDEX "plan_upgrade_requests_status_created_at_idx" ON "plan_upgrade_requests"("status", "created_at");

ALTER TABLE "plan_upgrade_requests"
  ADD CONSTRAINT "plan_upgrade_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "plan_upgrade_requests"
  ADD CONSTRAINT "plan_upgrade_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

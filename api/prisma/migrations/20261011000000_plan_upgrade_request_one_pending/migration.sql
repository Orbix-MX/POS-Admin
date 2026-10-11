-- Una sola solicitud de mejora PENDIENTE por empresa.
--
-- `PlanUpgradeRequestsService.request` mira si ya hay una pendiente y, si no, crea; dos
-- peticiones simultáneas de la misma empresa cruzan esa comprobación y dejaban dos. El
-- índice es la garantía (mismo patrón que `cash_sessions_one_open_per_register_key`); el
-- servicio traduce la violación a "actualizar la que ganó".
--
-- Parcial a propósito: las atendidas y canceladas se conservan como historial, sin límite.
CREATE UNIQUE INDEX "plan_upgrade_requests_one_pending_per_tenant_key"
ON "plan_upgrade_requests" ("tenant_id")
WHERE status = 'PENDING';

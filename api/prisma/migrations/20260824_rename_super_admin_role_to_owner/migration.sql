-- Unifica el nombre del rol de fábrica full-access de cada tenant a "Owner".
-- Antes "PlatformTenantsService"/"seed.ts" lo creaban como "Super Admin" —
-- mismo texto que el enum global UserRole.SUPER_ADMIN (staff de Orbix con
-- bypass total), lo que confundía ambos conceptos en logs/auditoría.
--
-- Se salta el tenant que ya tuviera un rol "Owner" propio (colisión con el
-- unique [tenantId, name]) en vez de fallar la migración entera por ese caso.
UPDATE "public"."roles" AS r
SET "name" = 'Owner'
WHERE r."name" = 'Super Admin'
  AND r."isSystem" = true
  AND NOT EXISTS (
    SELECT 1 FROM "public"."roles" AS r2
    WHERE r2."tenantId" = r."tenantId"
      AND r2."name" = 'Owner'
      AND r2."id" <> r."id"
  );

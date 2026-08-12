-- Permiso dedicado para autorizar cortes descuadrados.
--
-- Hasta ahora `closeWithAuth` exigía `pos.cash:close`, el mismo permiso que
-- cerrar una caja normal: cualquiera que pudiera cerrar podía también firmar su
-- propio descuadre. Se separa en `pos.cash:authorize`.
--
-- El backfill lo concede a todo rol que ya tuviera `pos.cash:close`, para que
-- nadie pierda la capacidad en silencio con el despliegue. A partir de ahí es
-- revocable por rol: quitarlo restringe la autorización sin tocar el cierre.
--
-- La fila del permiso la crea `PermissionsService.seedPermissions` al arrancar;
-- aquí se inserta también por si el backfill corre antes que ese arranque.
INSERT INTO "permissions" ("id", "key", "name", "description", "module", "action")
VALUES (
  gen_random_uuid(),
  'pos.cash:authorize',
  'Autorizar corte descuadrado',
  'Permite firmar el cierre de un corte que quedó pendiente de revisión por exceder el umbral de diferencia. Separado de cash:close para que autorizar sea más restrictivo que cerrar',
  'pos',
  'cash:authorize'
)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT rp."roleId", nuevo."id"
FROM "role_permissions" rp
JOIN "permissions" viejo ON viejo."id" = rp."permissionId" AND viejo."key" = 'pos.cash:close'
CROSS JOIN (SELECT "id" FROM "permissions" WHERE "key" = 'pos.cash:authorize') nuevo
WHERE NOT EXISTS (
  SELECT 1 FROM "role_permissions" ya
  WHERE ya."roleId" = rp."roleId" AND ya."permissionId" = nuevo."id"
);

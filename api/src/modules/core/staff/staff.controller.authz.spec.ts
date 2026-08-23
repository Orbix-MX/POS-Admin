import { StaffController } from './staff.controller';
import { PERMISSIONS_KEY } from '../../../common/decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

/**
 * Regresión de cobertura de autorización en `StaffController`.
 *
 * Los endpoints de administración de PIN asignan además un `roleId` al empleado,
 * es decir, otorgan permisos RBAC. No declaraban `@RequirePermissions`, y como
 * `PermissionsGuard` concede por defecto cuando falta el decorador, quedaban
 * abiertos a CUALQUIER usuario autenticado del tenant: un cajero con solo
 * `pos:access` podía asignarse un PIN con el rol que quisiera y luego operar con
 * esos permisos.
 *
 * Si alguien vuelve a quitar un decorador de estos, estos tests se ponen rojos.
 */

/** Lee la metadata de permisos declarada sobre un método del controller. */
function permissionsOf(method: keyof StaffController): string[] | undefined {
  return Reflect.getMetadata(PERMISSIONS_KEY, StaffController.prototype[method]);
}

function isPublic(method: keyof StaffController): boolean {
  return Reflect.getMetadata(IS_PUBLIC_KEY, StaffController.prototype[method]) === true;
}

describe('StaffController — endpoints de administración de PIN', () => {
  it('`assignPin` debe exigir un permiso explícito', () => {
    expect(permissionsOf('assignPin')).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('`clearPin` debe exigir un permiso explícito', () => {
    expect(permissionsOf('clearPin')).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('`verifyPin` debe exigir un permiso explícito', () => {
    expect(permissionsOf('verifyPin')).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('ninguno de los endpoints de PIN administrativos es público', () => {
    expect(isPublic('assignPin')).toBe(false);
    expect(isPublic('clearPin')).toBe(false);
    expect(isPublic('verifyPin')).toBe(false);
  });
});

describe('StaffController — cobertura vigente que no debe romperse', () => {
  it('`operatorLogin` sigue exigiendo `comanda:view`', () => {
    expect(permissionsOf('operatorLogin')).toContain('comanda:view');
  });

  it('`pinLogin` sigue siendo público (el principal es el dispositivo, no un usuario)', () => {
    expect(isPublic('pinLogin')).toBe(true);
  });
});

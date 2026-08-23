import * as fs from 'fs';
import * as path from 'path';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { NO_PERMISSIONS_REQUIRED_KEY } from '../decorators/no-permissions-required.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Cobertura de autorización de TODOS los endpoints HTTP del API.
 *
 * `PermissionsGuard` deniega por defecto, así que cada handler debe declarar
 * cómo se autoriza: `@RequirePermissions`, `@Roles`, `@Public` (sin sesión) o
 * `@NoPermissionsRequired` (con sesión, sin permiso concreto). Este test recorre
 * los controllers y falla si aparece uno sin declarar.
 *
 * La lista sale de la metadata de Nest, no de una lista escrita a mano: un
 * controller nuevo entra en el conteo solo por existir.
 */

const SRC = path.resolve(__dirname, '../..');

function findControllers(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findControllers(full, found);
    else if (entry.name.endsWith('.controller.ts')) found.push(full);
  }
  return found;
}

interface Handler {
  controller: string;
  method: string;
  file: string;
  declared: boolean;
}

function collectHandlers(): Handler[] {
  const handlers: Handler[] = [];

  for (const file of findControllers(SRC)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(file) as Record<string, unknown>;

    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      if (Reflect.getMetadata('path', exported) === undefined) continue;

      const proto = (exported as { prototype: object }).prototype;
      const classPublic = Reflect.getMetadata(IS_PUBLIC_KEY, exported) === true;
      const classPerms = Reflect.getMetadata(PERMISSIONS_KEY, exported) as string[] | undefined;
      const classRoles = Reflect.getMetadata(ROLES_KEY, exported) as string[] | undefined;

      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === 'constructor') continue;
        const handler = (proto as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        // Only real HTTP handlers carry both a route and a verb.
        if (Reflect.getMetadata('path', handler) === undefined) continue;
        if (Reflect.getMetadata('method', handler) === undefined) continue;

        const perms = (Reflect.getMetadata(PERMISSIONS_KEY, handler) as string[]) ?? classPerms;
        const roles = (Reflect.getMetadata(ROLES_KEY, handler) as string[]) ?? classRoles;
        const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true || classPublic;
        const noPerms = Reflect.getMetadata(NO_PERMISSIONS_REQUIRED_KEY, handler) === true;

        handlers.push({
          controller: (exported as { name: string }).name,
          method: name,
          file: path.relative(SRC, file).replace(/\\/g, '/'),
          declared: Boolean(perms?.length) || Boolean(roles?.length) || isPublic || noPerms,
        });
      }
    }
  }

  return handlers;
}

describe('Cobertura de autorización de endpoints', () => {
  const handlers = collectHandlers();

  it('encuentra los controllers del API (el recorrido no está vacío)', () => {
    expect(handlers.length).toBeGreaterThan(300);
  });

  it('todo handler HTTP declara cómo se autoriza', () => {
    const undeclared = handlers
      .filter((h) => !h.declared)
      .map((h) => `${h.file} → ${h.controller}.${h.method}`);

    // Mensaje explícito: quien añada un endpoint nuevo ve aquí qué le falta.
    expect(undeclared).toEqual([]);
  });
});

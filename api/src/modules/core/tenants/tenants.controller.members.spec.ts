import 'reflect-metadata';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { TenantsController } from './tenants.controller';

/**
 * @odd aislamiento-de-cupones T-003 (A-1)
 * `POST current/members/:userId` añadía a CUALQUIER usuario existente a la empresa del llamador sin su consentimiento
 * (ADR-0031: las altas van por invitación aceptada). No tenía clientes y se retiró; solo debe quedar el DELETE.
 */
describe('TenantsController — gestión de miembros', () => {
  const proto = TenantsController.prototype as unknown as Record<string, object>;
  const handlers = Object.getOwnPropertyNames(proto).filter(
    (n) => n !== 'constructor' && typeof proto[n] === 'function',
  );
  const routes = handlers.map((n) => ({
    name: n,
    path: String(Reflect.getMetadata(PATH_METADATA, proto[n]) ?? ''),
    method: Reflect.getMetadata(METHOD_METADATA, proto[n]) as RequestMethod,
  }));

  it('no hay ningún POST sobre current/members', () => {
    const posts = routes.filter((r) => r.path.startsWith('current/members') && r.method === RequestMethod.POST);

    expect(posts).toEqual([]);
  });

  it('no tiene un handler addMember', () => {
    expect(handlers).not.toContain('addMember');
  });

  it('las rutas de miembros que sí existen siguen ahí (la prueba mira el controlador correcto)', () => {
    const members = routes.filter((r) => r.path.startsWith('current/members')).map((r) => `${RequestMethod[r.method]} ${r.path}`);

    expect(members).toEqual(expect.arrayContaining(['GET current/members', 'DELETE current/members/:userId']));
  });
});

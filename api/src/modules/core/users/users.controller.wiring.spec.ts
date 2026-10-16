import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { UsersController } from './users.controller';

/**
 * @odd aislamiento-de-cupones T-003 (A-1)
 * La regla "la identidad global solo la cambia su dueña" necesita saber quién actúa. Ese id llega por el controlador
 * (`@CurrentUser('id')`), no por `AuditContextService`: `DatabaseModule` declara una segunda instancia de ese servicio
 * y, según el módulo, la inyectada no es la que llena el interceptor.
 */
describe('UsersController.update — el actor llega al servicio', () => {
  it('pasa id, dto y actorId a su posición', async () => {
    const usersService = { update: jest.fn().mockResolvedValue({}) };
    const controller = new UsersController(usersService as never);

    await controller.update('target', { firstName: 'Ana' }, 'actor');

    expect(usersService.update).toHaveBeenCalledWith('target', { firstName: 'Ana' }, 'actor');
  });

  it('declara @CurrentUser("id") en el tercer parámetro', () => {
    const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, UsersController, 'update') as Record<
      string,
      { index: number; data: unknown }
    >;

    expect(Object.values(meta ?? {})).toContainEqual(expect.objectContaining({ index: 2, data: 'id' }));
  });
});

import 'reflect-metadata';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { StaffController } from './staff.controller';

/**
 * @odd bloqueo-por-intentos-de-pin T-002
 * El contador de intentos cuelga del usuario de la sesión, y ese usuario llega al servicio por el controlador
 * (`@CurrentUser('id')`), no por un servicio de contexto: una primera versión leyó el contexto, recibió
 * `undefined` y rechazaba TODO PIN. Estos tests fijan el cableado que los de servicio no ven.
 */

const TENANT = 'tenant-1';

function build() {
  const staffService = {
    verifyPin: jest.fn().mockResolvedValue({}),
    operatorLogin: jest.fn().mockResolvedValue({}),
    pinLogin: jest.fn().mockResolvedValue({}),
  };
  const controller = new StaffController(staffService as never, { requireTenantId: () => TENANT } as never);
  return { controller, staffService };
}

/** Parámetros de un handler que vienen de un decorador personalizado, con su índice y su `data`. */
function customParams(handler: string): { index: number; data: unknown }[] {
  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, StaffController, handler) as Record<
    string,
    { index: number; data: unknown }
  >;
  return Object.values(meta ?? {}).map(({ index, data }) => ({ index, data }));
}

describe('StaffController — el usuario de la sesión llega al servicio', () => {
  it('pin-verify pasa tenant, pin y userId a su posición', async () => {
    const { controller, staffService } = build();

    await controller.verifyPin({ pin: '1234' }, 'user-9');

    expect(staffService.verifyPin).toHaveBeenCalledWith(TENANT, '1234', 'user-9');
  });

  it('operator-login pasa tenant, pin, branchId y userId a su posición', async () => {
    const { controller, staffService } = build();

    await controller.operatorLogin({ pin: '1234', branchId: 'b1' }, 'user-9');

    expect(staffService.operatorLogin).toHaveBeenCalledWith(TENANT, '1234', 'b1', 'user-9');
  });

  it('pin-login (dispositivo) pasa deviceToken y pin, sin userId', async () => {
    const { controller, staffService } = build();

    await controller.pinLogin({ deviceToken: 'tok', pin: '1234' });

    expect(staffService.pinLogin).toHaveBeenCalledWith('tok', '1234');
  });

  it.each(['verifyPin', 'operatorLogin'])('%s declara @CurrentUser("id") en el segundo parámetro', (handler) => {
    // Sin este decorador Nest inyectaría `undefined` y el servicio rechazaría todo PIN.
    expect(customParams(handler)).toContainEqual({ index: 1, data: 'id' });
  });
});

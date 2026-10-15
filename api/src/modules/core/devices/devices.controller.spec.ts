import { DevicesController } from './devices.controller';

/**
 * @odd credenciales-de-dispositivo T-002/T-004
 * `validate(deviceId, deviceToken, appVersion?)` recibe dos strings seguidos: invertirlos compila y deja a
 * todos los dispositivos como `registered:false`. Este test fija qué campo del body va a cada parámetro.
 */

const TENANT = 'tenant-1';

function build() {
  const devicesService = {
    validate: jest.fn().mockResolvedValue({ registered: false }),
    list: jest.fn().mockResolvedValue([]),
    revoke: jest.fn().mockResolvedValue({}),
  };
  const tenantContext = { requireTenantId: jest.fn().mockReturnValue(TENANT) };
  const controller = new DevicesController(devicesService as never, {} as never, tenantContext as never);
  return { controller, devicesService };
}

describe('DevicesController — cableado', () => {
  it('validate pasa deviceId, deviceToken y appVersion a su parámetro, en ese orden', async () => {
    const { controller, devicesService } = build();

    await controller.validate({ deviceId: 'id-del-dispositivo', deviceToken: 'token-del-dispositivo', appVersion: '1.2.3' });

    expect(devicesService.validate).toHaveBeenCalledWith('id-del-dispositivo', 'token-del-dispositivo', '1.2.3');
  });

  it('list y revoke toman la empresa del contexto, no del request', async () => {
    const { controller, devicesService } = build();

    await controller.list();
    await controller.revoke('dev-1');

    expect(devicesService.list).toHaveBeenCalledWith(TENANT);
    expect(devicesService.revoke).toHaveBeenCalledWith(TENANT, 'dev-1');
  });
});

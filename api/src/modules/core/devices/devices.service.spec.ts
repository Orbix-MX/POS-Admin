import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DevicesService } from './devices.service';
import { ValidateDeviceDto } from './dto/validate-device.dto';

/**
 * @odd credenciales-de-dispositivo T-001 / T-002 / T-004
 *  - El listado no entrega el `deviceToken` (credencial del dispositivo) a quien solo tiene permiso de lectura.
 *  - `validate` exige prueba de posesión y nunca devuelve el token; uno que no corresponde responde como si
 *    el dispositivo no existiera.
 */

const TENANT = 'tenant-1';
const DEVICE_ID = 'dev-uuid-1234-aaaa';
const TOKEN = 'a'.repeat(64);

type Row = { id: string; tenantId: string; deviceId: string; deviceToken: string | null; status: string; branchId: string | null };

const ROW: Row = { id: 'd1', tenantId: TENANT, deviceId: DEVICE_ID, deviceToken: TOKEN, status: 'ACTIVE', branchId: null };

function build(row: Row | null = ROW) {
  const prisma = {
    device: {
      findUnique: jest.fn().mockResolvedValue(row),
      findFirst: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(row),
    },
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: TENANT, name: 'Empresa', slug: 'empresa', restaurantServiceMode: 'HYBRID', plan: 'PRO', enabledModules: [], settings: {},
      }),
    },
    branch: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const licenseService = { validateLicense: jest.fn().mockResolvedValue({ valid: true }) };
  const service = new DevicesService(prisma as never, licenseService as never, {} as never);
  return { service, prisma };
}

describe('DevicesService.list — T-001: sin credenciales', () => {
  it('pide un select explícito que no incluye deviceToken', async () => {
    const { service, prisma } = build();

    await service.list(TENANT);

    const arg = prisma.device.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ tenantId: TENANT });
    expect(arg.select).toBeDefined();
    expect(Object.keys(arg.select)).not.toContain('deviceToken');
    expect(arg.select).toMatchObject({ id: true, deviceId: true, name: true, status: true, lastSeenAt: true, activatedAt: true });
  });
});

describe('DevicesService.validate — T-002/T-004: prueba de posesión', () => {
  it('con el token correcto: registered y NO devuelve el token', async () => {
    const { service, prisma } = build();

    const res = await service.validate(DEVICE_ID, TOKEN, '1.0.0');

    expect(res).toMatchObject({ registered: true });
    expect(res).not.toHaveProperty('deviceToken');
    expect(prisma.device.findUnique).toHaveBeenCalledWith({ where: { deviceToken: TOKEN } });
  });

  it('nunca busca por deviceId solo (no hay camino que entregue el token a quien únicamente lo conoce)', async () => {
    const { service, prisma } = build();

    await service.validate(DEVICE_ID, TOKEN);

    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  it.each([undefined, ''])('sin token (%p): registered false, sin consultar la base ni devolver nada', async (token) => {
    const { service, prisma } = build();

    const res = await service.validate(DEVICE_ID, token);

    expect(res).toEqual({ registered: false });
    expect(prisma.device.findUnique).not.toHaveBeenCalled();
    expect(prisma.device.findFirst).not.toHaveBeenCalled();
  });

  it('token válido pero de OTRO deviceId: responde como dispositivo desconocido', async () => {
    const { service } = build({ ...ROW, deviceId: 'otro-dispositivo' });

    await expect(service.validate(DEVICE_ID, TOKEN)).resolves.toEqual({ registered: false });
  });

  it('token inexistente: registered false', async () => {
    const { service } = build(null);

    await expect(service.validate(DEVICE_ID, 'x'.repeat(64))).resolves.toEqual({ registered: false });
  });

  it('dispositivo revocado, aun con su token: registered false', async () => {
    const { service } = build({ ...ROW, status: 'REVOKED', deviceToken: null });

    await expect(service.validate(DEVICE_ID, TOKEN)).resolves.toEqual({ registered: false });
  });

  it('las tres negativas tienen la misma forma (no revelan cuál comprobación falló)', async () => {
    const unknown = await build(null).service.validate(DEVICE_ID, TOKEN);
    const other = await build({ ...ROW, deviceId: 'otro' }).service.validate(DEVICE_ID, TOKEN);
    const revoked = await build({ ...ROW, status: 'REVOKED' }).service.validate(DEVICE_ID, TOKEN);

    expect(other).toEqual(unknown);
    expect(revoked).toEqual(unknown);
  });

  it('actualiza lastSeenAt y la versión del dispositivo validado', async () => {
    const { service, prisma } = build();

    await service.validate(DEVICE_ID, TOKEN, '1.2.3');

    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: expect.objectContaining({ appVersion: '1.2.3', lastSeenAt: expect.any(Date) }),
    });
  });
});

describe('ValidateDeviceDto — T-004: el token ya no se exige en el DTO', () => {
  const check = (plain: object) => validate(plainToInstance(ValidateDeviceDto, plain));

  // Un 400 aquí haría que una app anterior lo lea como "sin red" y arranque desde caché sin validar la
  // licencia; la ausencia se resuelve en el servicio con `registered:false`.
  it('sin deviceToken: el DTO es válido (no hay 400)', async () => {
    await expect(check({ deviceId: DEVICE_ID })).resolves.toHaveLength(0);
  });

  it('deviceToken no textual: se rechaza', async () => {
    const errors = await check({ deviceId: DEVICE_ID, deviceToken: 123 });
    expect(errors.map((e) => e.property)).toContain('deviceToken');
  });

  it('con deviceId y deviceToken: válido', async () => {
    await expect(check({ deviceId: DEVICE_ID, deviceToken: TOKEN, appVersion: '1.0.0' })).resolves.toHaveLength(0);
  });
});

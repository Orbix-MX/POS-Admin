import 'dotenv/config';
import { randomBytes } from 'crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import { PinAttemptService } from '../src/common/services/pin-attempt.service';

/**
 * @odd bloqueo-por-intentos-de-pin T-001
 * Contra la base real: lo que los tests con mocks no pueden probar (el incremento atómico bajo concurrencia, la
 * ventana de 24 h y la regla del acierto viven en SQL). Usa claves de prueba propias y las borra al terminar.
 */
describe('PinAttemptService contra la base (e2e)', () => {
  let prisma: PrismaService;
  let service: PinAttemptService;
  const keys: string[] = [];

  const newKey = () => {
    const k = 'e2e-' + randomBytes(5).toString('hex');
    keys.push(k);
    return k;
  };
  const row = (key: string, scope: 'USER' | 'DEVICE' = 'USER') =>
    prisma.pinAttempt.findUnique({ where: { scope_scopeKey: { scope, scopeKey: key } } });
  const backdate = (key: string, interval: string) =>
    prisma.$executeRawUnsafe(
      `UPDATE pin_attempts SET last_failed_at = NOW() - INTERVAL '${interval}' WHERE scope_key = $1`,
      key,
    );

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new PinAttemptService(prisma);
  });

  afterAll(async () => {
    await prisma.pinAttempt.deleteMany({ where: { scopeKey: { in: keys } } });
    await prisma.$disconnect();
  });

  it('20 fallos simultáneos del mismo principal cuentan exactamente 20 y dejan bloqueo de ~8 min', async () => {
    const key = newKey();

    await Promise.all(Array.from({ length: 20 }, () => service.registerFailure('USER', key)));

    const r = await row(key);
    expect(r?.attempts).toBe(20);
    const minutes = Math.round(((r?.lockedUntil?.getTime() ?? 0) - Date.now()) / 60_000);
    expect(minutes).toBeGreaterThanOrEqual(7);
    expect(minutes).toBeLessThanOrEqual(8);
  });

  it('bloqueado: assertNotLocked responde 429 PIN_LOCKED; el mismo identificador como DEVICE no', async () => {
    const key = newKey();
    for (let i = 0; i < 5; i++) await service.registerFailure('USER', key);

    const err = await service.assertNotLocked('USER', key).catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toMatchObject({ code: 'PIN_LOCKED' });

    await expect(service.assertNotLocked('DEVICE', key)).resolves.toBeUndefined();
  });

  it('4 fallos cuentan pero no bloquean; el 5º bloquea', async () => {
    const key = newKey();
    for (let i = 0; i < 4; i++) await service.registerFailure('USER', key);
    expect((await row(key))?.lockedUntil).toBeNull();

    await service.registerFailure('USER', key);
    expect((await row(key))?.lockedUntil).not.toBeNull();
  });

  it('un acierto JUSTO después de fallar NO borra los fallos (no se puede intercalar el PIN propio)', async () => {
    const key = newKey();
    for (let i = 0; i < 4; i++) await service.registerFailure('USER', key);

    await service.registerSuccess('USER', key);

    expect((await row(key))?.attempts).toBe(4);
    // Y por tanto el siguiente fallo sí alcanza el umbral, aunque se haya intercalado un acierto.
    await service.registerFailure('USER', key);
    expect((await row(key))?.lockedUntil).not.toBeNull();
  });

  it('un acierto tras una hora sin fallos sí limpia contador y bloqueo', async () => {
    const key = newKey();
    for (let i = 0; i < 5; i++) await service.registerFailure('USER', key);
    await prisma.$executeRawUnsafe(`UPDATE pin_attempts SET locked_until = NULL WHERE scope_key = $1`, key);
    await backdate(key, '2 hours');

    await service.registerSuccess('USER', key);

    const r = await row(key);
    expect(r?.attempts).toBe(0);
    expect(r?.lockedUntil).toBeNull();
  });

  it('un último fallo de hace más de 24 h reinicia el contador a 1', async () => {
    const key = newKey();
    for (let i = 0; i < 3; i++) await service.registerFailure('USER', key);
    await backdate(key, '25 hours');

    await service.registerFailure('USER', key);

    expect((await row(key))?.attempts).toBe(1);
  });
});

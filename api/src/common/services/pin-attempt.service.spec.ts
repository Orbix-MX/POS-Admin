import { HttpException } from '@nestjs/common';
import {
  PIN_ATTEMPT_WINDOW_MS,
  PIN_LOCKOUT_MAX_MINUTES,
  PIN_SUCCESS_RESET_AFTER_MS,
  PinAttemptService,
  isMissingTableError,
} from './pin-attempt.service';

/**
 * @odd bloqueo-por-intentos-de-pin T-001
 * La política (umbral, escalado, tope) es lógica pura; el incremento atómico y la concurrencia real se
 * verifican contra la base con la API arrancada (C-021), no con estos mocks.
 */

function build(row: { lockedUntil: Date | null } | null = null, attemptsAfterFailure = 1) {
  const prisma = {
    pinAttempt: {
      findUnique: jest.fn().mockResolvedValue(row),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ attempts: attemptsAfterFailure }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  return { service: new PinAttemptService(prisma as never), prisma };
}

describe('PinAttemptService.lockMinutes — política', () => {
  it.each([
    [0, 0], [1, 0], [4, 0], // antes del umbral no bloquea
    [5, 1], [9, 1], // primer bloqueo
    [10, 2], [14, 2],
    [15, 4], [20, 8], [25, 16], [30, 32],
    [35, PIN_LOCKOUT_MAX_MINUTES], [500, PIN_LOCKOUT_MAX_MINUTES], // tope
  ])('%i fallos seguidos -> %i min', (attempts, minutes) => {
    expect(PinAttemptService.lockMinutes(attempts)).toBe(minutes);
  });

  it('el tope es 60 min y nunca se supera', () => {
    for (let n = 0; n < 2000; n += 7) {
      expect(PinAttemptService.lockMinutes(n)).toBeLessThanOrEqual(60);
    }
  });
});

describe('PinAttemptService.assertNotLocked', () => {
  it('sin fila: pasa', async () => {
    const { service } = build(null);
    await expect(service.assertNotLocked('DEVICE', 'dev-1')).resolves.toBeUndefined();
  });

  it('bloqueo vencido: pasa', async () => {
    const { service } = build({ lockedUntil: new Date(Date.now() - 1000) });
    await expect(service.assertNotLocked('USER', 'u1')).resolves.toBeUndefined();
  });

  it('en espera: 429 PIN_LOCKED con retryAfterSeconds', async () => {
    const { service } = build({ lockedUntil: new Date(Date.now() + 90_000) });

    const err = await service.assertNotLocked('USER', 'u1').catch((e) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.getResponse()).toMatchObject({ statusCode: 429, code: 'PIN_LOCKED' });
    const retry = (err.getResponse() as { retryAfterSeconds: number }).retryAfterSeconds;
    expect(retry).toBeGreaterThan(80);
    expect(retry).toBeLessThanOrEqual(90);
  });

  it('consulta por (scope, scopeKey): dispositivo y usuario son principales distintos', async () => {
    const { service, prisma } = build(null);

    await service.assertNotLocked('DEVICE', 'abc');
    await service.assertNotLocked('USER', 'abc');

    expect(prisma.pinAttempt.findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { scope_scopeKey: { scope: 'DEVICE', scopeKey: 'abc' } } }));
    expect(prisma.pinAttempt.findUnique).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { scope_scopeKey: { scope: 'USER', scopeKey: 'abc' } } }));
  });
});

describe('PinAttemptService.registerFailure', () => {
  it('antes del umbral cuenta pero no fija bloqueo', async () => {
    const { service, prisma } = build(null, 4);

    await service.registerFailure('USER', 'u1');

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('al llegar al umbral fija el bloqueo', async () => {
    const { service, prisma } = build(null, 5);

    await service.registerFailure('DEVICE', 'dev-1');

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('el incremento va en una sola sentencia SQL (atómico), con la ventana de 24 h como parámetro', async () => {
    const { service, prisma } = build(null, 1);
    const before = Date.now();

    await service.registerFailure('USER', 'u1');

    const [strings, ...values] = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join('?');
    expect(sql).toContain('ON CONFLICT (scope, scope_key) DO UPDATE');
    expect(sql).toContain('pin_attempts.attempts + 1');
    expect(sql).toContain('RETURNING attempts');
    const staleBefore = values.find((v) => v instanceof Date) as Date;
    expect(before - staleBefore.getTime()).toBeGreaterThanOrEqual(PIN_ATTEMPT_WINDOW_MS - 50);
  });

  it('el bloqueo usa GREATEST: dos fallos concurrentes no se pisan hacia una espera menor', async () => {
    const { service, prisma } = build(null, 10);

    await service.registerFailure('USER', 'u1');

    const [strings] = prisma.$executeRaw.mock.calls[0] as [TemplateStringsArray];
    expect(strings.join('?')).toContain('GREATEST(');
  });
});

describe('PinAttemptService.registerSuccess — un acierto no borra fallos recientes', () => {
  it('limpia solo si el último fallo es más viejo que PIN_SUCCESS_RESET_AFTER_MS', async () => {
    const { service, prisma } = build();
    const before = Date.now();

    await service.registerSuccess('DEVICE', 'dev-1');

    const arg = prisma.pinAttempt.updateMany.mock.calls[0][0];
    expect(arg.where).toMatchObject({
      scope: 'DEVICE',
      scopeKey: 'dev-1',
      OR: [{ attempts: { gt: 0 } }, { lockedUntil: { not: null } }],
    });
    const cutoff = arg.where.lastFailedAt.lt as Date;
    expect(before - cutoff.getTime()).toBeGreaterThanOrEqual(PIN_SUCCESS_RESET_AFTER_MS - 50);
    expect(arg.data).toEqual({ attempts: 0, lockedUntil: null });
  });

  it('el reinicio por acierto tarda menos que la ventana de olvido (acertar no es más lento que esperar)', () => {
    expect(PIN_SUCCESS_RESET_AFTER_MS).toBeLessThan(PIN_ATTEMPT_WINDOW_MS);
  });
});

describe('PinAttemptService — aviso al bloquear', () => {
  it('registra un aviso cuando se fija un bloqueo, sin el identificador completo', async () => {
    const { service } = build(null, 5);
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    await service.registerFailure('USER', 'abcdef12-3456-7890-aaaa-bbbbbbbbbbbb');

    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain('USER');
    expect(msg).not.toContain('abcdef12-3456-7890-aaaa-bbbbbbbbbbbb');
  });

  it('antes del umbral no avisa', async () => {
    const { service } = build(null, 4);
    const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

    await service.registerFailure('USER', 'u1');

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('PinAttemptService — código desplegado antes que su migración', () => {
  const missing = Object.assign(new Error('The table `public.pin_attempts` does not exist'), { code: 'P2021' });

  it.each([
    ['P2021', missing],
    ['P2010 con 42P01 (consulta cruda)', Object.assign(new Error('raw'), { code: 'P2010', meta: { code: '42P01' } })],
    ['mensaje de Postgres', new Error('relation "pin_attempts" does not exist')],
  ])('reconoce la tabla ausente: %s', (_name, err) => {
    expect(isMissingTableError(err)).toBe(true);
  });

  it.each([
    ['red', Object.assign(new Error('connection refused'), { code: 'P1001' })],
    ['otra tabla', new Error('relation "users" does not exist')],
    ['nulo', null],
  ])('NO confunde otros fallos con tabla ausente: %s', (_name, err) => {
    expect(isMissingTableError(err)).toBe(false);
  });

  it('con la tabla ausente el login por PIN no cae: las tres operaciones degradan y gritan en el log', async () => {
    const { service, prisma } = build();
    prisma.pinAttempt.findUnique.mockRejectedValue(missing);
    prisma.$queryRaw.mockRejectedValue(missing);
    prisma.pinAttempt.updateMany.mockRejectedValue(missing);
    const error = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

    await expect(service.assertNotLocked('USER', 'u1')).resolves.toBeUndefined();
    await expect(service.registerFailure('USER', 'u1')).resolves.toBeUndefined();
    await expect(service.registerSuccess('USER', 'u1')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledTimes(3);
    expect(String(error.mock.calls[0][0])).toContain('DESACTIVADO');
  });

  it('cualquier OTRO error de la base se propaga (no se abre en silencio)', async () => {
    const { service, prisma } = build();
    prisma.pinAttempt.findUnique.mockRejectedValue(Object.assign(new Error('connection refused'), { code: 'P1001' }));

    await expect(service.assertNotLocked('USER', 'u1')).rejects.toThrow('connection refused');
  });
});

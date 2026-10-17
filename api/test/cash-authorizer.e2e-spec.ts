import 'dotenv/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import { CashSessionsService } from '../src/modules/core/cash-sessions/cash-sessions.service';

/**
 * @odd aislamiento-de-cupones T-003 (A-2)
 * Contra la base real: un cajero de una empresa no puede bloquear la cuenta de un usuario de OTRA (contándole fallos de
 * contraseña al autorizar un corte de caja) ni distinguir, por el mensaje, si una contraseña ajena es válida. El autorizador
 * legítimo de la empresa conserva su bloqueo.
 *
 * Estos e2e NO corren en el CI (sin base de datos): se ejecutan a mano con `jest --config test/jest-e2e.json`. Sus datos llevan
 * el prefijo `e2e-auth-` y se borran al terminar; el siguiente `beforeAll` barre los restos de una ejecución caída, pero SOLO los
 * de más de `STALE_MS`, para no pisar una ejecución simultánea.
 */
const PREFIX = 'e2e-auth-';
/** Un resto de prueba más viejo que esto se considera de una ejecución caída (mismo umbral en todos los e2e con barrido previo). */
const STALE_MS = 10 * 60_000;
const PASSWORD = 'contraseña-del-admin';
const GENERIC = 'Credenciales del autorizador incorrectas';

describe('Autorizador de caja — aislamiento entre empresas (e2e)', () => {
  let prisma: PrismaService | undefined;
  const tenantIds: string[] = [];
  const userIds: string[] = [];
  let currentTenant = '';
  let hash = '';

  const db = () => prisma as PrismaService;
  const sfx = () => randomBytes(4).toString('hex');
  const service = () =>
    new CashSessionsService(
      db(),
      { requireTenantId: () => currentTenant, getBranchId: () => null } as never,
      { getUserId: () => 'cajero' } as never,
      { log: jest.fn() } as never,
      {} as never,
      { get: () => 'irrelevante' } as never,
      { assertNotLocked: jest.fn(), registerFailure: jest.fn(), registerSuccess: jest.fn() } as never,
    );
  const verify = (email: string, authPassword: string) => service().verifyCloseAuth({ authEmail: email, authPassword });
  const attempts = async (id: string) => {
    const u = await db().user.findUniqueOrThrow({ where: { id } });
    return { failed: u.failedLoginAttempts, locked: u.lockedUntil };
  };

  /** `soloViejos`: barrido previo; solo restos de más de `STALE_MS`, para no pisar una ejecución simultánea. Sin él: los datos de ESTA ejecución. */
  async function purge(soloViejos = false) {
    const old = { lt: new Date(Date.now() - STALE_MS) };
    const users = await db().user.findMany({
      where: soloViejos ? { email: { startsWith: PREFIX }, createdAt: old } : { email: { startsWith: PREFIX }, id: { in: userIds } },
      select: { id: true },
    });
    const tenants = await db().tenant.findMany({
      where: soloViejos ? { slug: { startsWith: PREFIX }, createdAt: old } : { id: { in: tenantIds } },
      select: { id: true },
    });
    const doomedUsers = users.map((u) => u.id);
    const ids = tenants.map((t) => t.id);
    await db().tenantMembership.deleteMany({ where: { OR: [{ userId: { in: doomedUsers } }, { tenantId: { in: ids } }] } });
    await db().user.deleteMany({ where: { id: { in: doomedUsers } } });
    await db().tenant.deleteMany({ where: { id: { in: ids } } });
  }

  async function company() {
    const tenant = await db().tenant.create({ data: { name: `E2E Auth ${sfx()}`, slug: `${PREFIX}${sfx()}` } });
    tenantIds.push(tenant.id);
    return tenant.id;
  }
  async function admin(tenantId: string, status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE') {
    const u = await db().user.create({
      data: { email: `${PREFIX}${sfx()}@orbix.test`, password: hash, firstName: 'Ana', lastName: 'Admin', role: 'SUPER_ADMIN' },
    });
    userIds.push(u.id);
    await db().tenantMembership.create({ data: { tenantId, userId: u.id, role: 'ADMIN', status } });
    return u;
  }

  let A = '';
  let B = '';

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    hash = await bcrypt.hash(PASSWORD, 4);
    await purge(true);
    A = await company();
    B = await company();
  });

  afterAll(async () => {
    try {
      if (prisma) await purge();
    } finally {
      await prisma?.$disconnect();
    }
  });

  it('contraseñas incorrectas contra una cuenta de OTRA empresa no le cuentan fallos ni la bloquean (antes sí)', async () => {
    const victim = await admin(B);
    currentTenant = A; // el cajero de A

    for (let i = 0; i < 8; i++) {
      await expect(verify(victim.email, `mal-${i}`)).rejects.toBeInstanceOf(ForbiddenException);
    }

    expect(await attempts(victim.id)).toEqual({ failed: 0, locked: null });
  });

  it('con la contraseña CORRECTA de una cuenta ajena, el mensaje es el mismo que con una incorrecta (sin oráculo)', async () => {
    const victim = await admin(B);
    currentTenant = A;

    const wrong = await verify(victim.email, 'mal').catch((e: Error) => e.message);
    const right = await verify(victim.email, PASSWORD).catch((e: Error) => e.message);
    const missing = await verify(`${PREFIX}no-existe@orbix.test`, PASSWORD).catch((e: Error) => e.message);

    expect(wrong).toBe(GENERIC);
    expect(right).toBe(GENERIC);
    expect(missing).toBe(GENERIC);
    expect(await attempts(victim.id)).toEqual({ failed: 0, locked: null });
  });

  it('una membresía INACTIVE en la empresa tampoco cuenta fallos', async () => {
    const baja = await admin(A, 'INACTIVE');
    currentTenant = A;

    await expect(verify(baja.email, 'mal')).rejects.toBeInstanceOf(ForbiddenException);

    expect(await attempts(baja.id)).toEqual({ failed: 0, locked: null });
  });

  it('el autorizador legítimo de la empresa autoriza con su contraseña', async () => {
    const boss = await admin(A);
    currentTenant = A;

    await expect(verify(boss.email, PASSWORD)).resolves.toEqual({ email: boss.email });
  });

  it('y conserva su protección: 5 contraseñas incorrectas desde su propia empresa SÍ bloquean su cuenta', async () => {
    const boss = await admin(A);
    currentTenant = A;

    for (let i = 0; i < 5; i++) await verify(boss.email, `mal-${i}`).catch(() => undefined);

    const state = await attempts(boss.id);
    expect(state.failed).toBe(5);
    expect(state.locked).not.toBeNull();
    // bloqueada: ni siquiera la contraseña correcta autoriza hasta que expire
    await expect(verify(boss.email, PASSWORD)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

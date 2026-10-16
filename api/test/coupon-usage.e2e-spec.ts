import 'dotenv/config';
import { randomBytes } from 'crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../src/database/prisma.service';
import { CouponsService } from '../src/modules/retail/coupons/coupons.service';

/**
 * @odd aislamiento-de-cupones T-001/T-002
 * Contra la base real: el SQL de `incrementUsage` (nombres de columna, el predicado de cupo, la fila acotada por
 * empresa) y su comportamiento bajo concurrencia y dentro de una transacción solo se pueden probar aquí; con
 * mocks cualquier cadena de SQL "pasa". Crea sus propias empresas y cupones y los borra al terminar.
 */
describe('CouponsService.incrementUsage contra la base (e2e)', () => {
  let prisma: PrismaService;
  const tenantIds: string[] = [];
  let currentTenant = '';

  const service = () =>
    new CouponsService(prisma as never, { requireTenantId: () => currentTenant } as never);

  const newTenant = async () => {
    const suffix = randomBytes(5).toString('hex');
    const t = await prisma.tenant.create({ data: { name: `E2E Cupones ${suffix}`, slug: `e2e-cupones-${suffix}` } });
    tenantIds.push(t.id);
    return t.id;
  };
  const newCoupon = (tenantId: string, usageLimit: number | null) =>
    prisma.coupon.create({
      data: {
        tenantId,
        code: 'E2E' + randomBytes(4).toString('hex').toUpperCase(),
        type: 'FIXED',
        value: 10,
        scope: 'GLOBAL',
        startDate: new Date(Date.now() - 86_400_000),
        usageLimit,
      },
    });
  const usage = async (id: string) => (await prisma.coupon.findUniqueOrThrow({ where: { id } })).usageCount;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
  });

  afterAll(async () => {
    // Los cupones caen en cascada con su empresa.
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    await prisma.$disconnect();
  });

  it('una empresa no puede sumar usos al cupón de otra (404) y su contador no se mueve', async () => {
    const tenantA = await newTenant();
    const tenantB = await newTenant();
    const coupon = await newCoupon(tenantA, 3);

    currentTenant = tenantB;
    await expect(service().incrementUsage(coupon.id)).rejects.toBeInstanceOf(NotFoundException);

    expect(await usage(coupon.id)).toBe(0);
  });

  it('la empresa dueña sí suma, y sin límite (usageLimit null) acepta 5 simultáneos exactos', async () => {
    const tenantId = await newTenant();
    const coupon = await newCoupon(tenantId, null);
    currentTenant = tenantId;

    await Promise.all(Array.from({ length: 5 }, () => service().incrementUsage(coupon.id)));

    expect(await usage(coupon.id)).toBe(5);
  });

  it('cupón de un solo uso con dos órdenes simultáneas: una pasa y la otra recibe 409 COUPON_EXHAUSTED', async () => {
    const tenantId = await newTenant();
    const coupon = await newCoupon(tenantId, 1);
    currentTenant = tenantId;

    const results = await Promise.allSettled([service().incrementUsage(coupon.id), service().incrementUsage(coupon.id)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ConflictException);
    expect((rejected?.reason as ConflictException).getResponse()).toMatchObject({ code: 'COUPON_EXHAUSTED' });
    expect(await usage(coupon.id)).toBe(1);
  });

  it('con un límite de 3 y 10 intentos simultáneos se aceptan exactamente 3', async () => {
    const tenantId = await newTenant();
    const coupon = await newCoupon(tenantId, 3);
    currentTenant = tenantId;

    const results = await Promise.allSettled(Array.from({ length: 10 }, () => service().incrementUsage(coupon.id)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await usage(coupon.id)).toBe(3);
  });

  it('dentro de una transacción que se revierte, el uso NO se gasta; si confirma, sí', async () => {
    const tenantId = await newTenant();
    const coupon = await newCoupon(tenantId, 5);
    currentTenant = tenantId;

    await expect(
      prisma.$transaction(async (tx) => {
        await service().incrementUsage(coupon.id, tx);
        throw new Error('la orden falló después de aplicar el cupón');
      }),
    ).rejects.toThrow('la orden falló');
    expect(await usage(coupon.id)).toBe(0);

    await prisma.$transaction(async (tx) => {
      await service().incrementUsage(coupon.id, tx);
    });
    expect(await usage(coupon.id)).toBe(1);
  });
});

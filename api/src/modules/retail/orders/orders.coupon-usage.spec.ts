import { ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * @odd aislamiento-de-cupones T-002
 * El uso del cupón se consume DENTRO de la transacción de la orden (con su `tx`): si la orden se revierte no se
 * gasta, y si el cupón se agotó entre validarlo y cobrar, la orden entera se rechaza.
 */

const TENANT = 'tenant-1';

function build(opts: { incrementUsage?: jest.Mock } = {}) {
  const tx = {
    order: { create: jest.fn().mockResolvedValue({ id: 'order-1' }), findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }) },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    payment: { create: jest.fn().mockResolvedValue({ id: 'pay' }) },
    customer: { update: jest.fn() },
    accountReceivable: { create: jest.fn() },
    cashMovement: { create: jest.fn().mockResolvedValue({ id: 'cm' }) },
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA' }) },
  };
  const prisma = {
    product: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'p1', name: 'Producto', sku: 'SKU1', taxRate: null, categoryId: null, recipe: null },
      ]),
    },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    tenant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', status: 'ABIERTA', exchangeRateUsdMxn: 20 }) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const incrementUsage = opts.incrementUsage ?? jest.fn().mockResolvedValue(undefined);
  const couponsService = {
    validateCoupon: jest.fn().mockResolvedValue({
      valid: true,
      discountAmount: 100,
      coupon: { id: 'coupon-1', code: 'PROMO' },
    }),
    incrementUsage,
  };
  const service = new OrdersService(
    prisma as never,
    { getUserId: () => 'user-1' } as never,
    { requireTenantId: () => TENANT, getBranchId: () => 'branch-1' } as never,
    couponsService as never,
    { log: jest.fn() } as never,
    { consume: jest.fn(), restore: jest.fn(), validate: jest.fn() } as never,
    { actorHas: jest.fn().mockResolvedValue(false) } as never,
  );
  return { service, tx, incrementUsage };
}

const withCoupon = { items: [{ productId: 'p1', quantity: 1, price: 1000 }], paymentMethod: 'CASH', couponCode: 'PROMO' };
const withoutCoupon = { items: [{ productId: 'p1', quantity: 1, price: 1000 }], paymentMethod: 'CASH' };

describe('OrdersService.create — uso del cupón dentro de la transacción', () => {
  it('consume el uso con el cliente de la transacción (tx), no con el cliente global', async () => {
    const { service, tx, incrementUsage } = build();

    await service.create(withCoupon);

    expect(incrementUsage).toHaveBeenCalledTimes(1);
    expect(incrementUsage).toHaveBeenCalledWith('coupon-1', tx);
  });

  it('si el cupón se agotó entre validar y cobrar, la orden se rechaza con el mismo error', async () => {
    const exhausted = new ConflictException({ code: 'COUPON_EXHAUSTED', message: 'agotado' });
    const { service } = build({ incrementUsage: jest.fn().mockRejectedValue(exhausted) });

    await expect(service.create(withCoupon)).rejects.toBe(exhausted);
  });

  it('sin cupón no se toca el contador', async () => {
    const { service, incrementUsage } = build();

    await service.create(withoutCoupon);

    expect(incrementUsage).not.toHaveBeenCalled();
  });
});

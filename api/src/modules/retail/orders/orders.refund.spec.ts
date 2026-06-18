import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';

/**
 * Focused tests for refundOrder's mixed model:
 *  - money-only refund (no lines) never touches inventory;
 *  - item-level refund restores exactly the refunded lines;
 *  - cumulative per-line cap prevents restoring a line twice (no over-stock);
 *  - amount must agree with the lines when both are supplied.
 * The service is built directly with mocks to bypass Nest DI noise.
 */

interface MockOrderItem {
  id: string;
  productId: string | null;
  itemType: 'PRODUCT' | 'SERVICE';
  quantity: number;
  total: number;
  name: string;
}

function buildOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'V-1',
    status: 'DELIVERED',
    paymentStatus: 'PAID',
    branchId: 'branch-1',
    createdAt: new Date(),
    accountReceivable: null,
    payments: [
      { amount: 200, status: 'PAID', paymentMethod: 'CASH', createdAt: new Date() },
    ],
    items: [
      { id: 'oi1', productId: 'p1', itemType: 'PRODUCT', quantity: 2, total: 160, name: 'Burger' } as MockOrderItem,
      { id: 'oi2', productId: 'p2', itemType: 'PRODUCT', quantity: 1, total: 40, name: 'Papas' } as MockOrderItem,
    ],
    refunds: [] as { amount: number; items: { orderItemId: string; quantity: number }[] }[],
    ...overrides,
  };
}

function buildService() {
  const restore = jest.fn();
  const orderRefundItemCreate = jest.fn().mockResolvedValue({});
  const orderRefundCreate = jest.fn().mockResolvedValue({ id: 'refund-1' });

  const tx = {
    cashSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sess-1', exchangeRateUsdMxn: 20 }) },
    cashMovement: { create: jest.fn().mockResolvedValue({ id: 'cm-1' }) },
    orderRefund: { create: orderRefundCreate },
    orderRefundItem: { create: orderRefundItemCreate },
    order: {
      update: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(buildOrder()),
    },
    accountReceivable: { update: jest.fn() },
  };

  const prisma = {
    order: { findFirst: jest.fn() },
    tenant: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const inventory = { restore, consume: jest.fn(), validate: jest.fn() };
  const service = new OrdersService(
    prisma as never,
    { getUserId: () => 'user-1' } as never,
    { requireTenantId: () => 'tenant-1', getBranchId: () => 'branch-1' } as never,
    { getAutoApplicableCoupons: jest.fn() } as never,
    { log: jest.fn() } as never,
    inventory as never,
  );

  return { service, prisma, tx, restore, orderRefundItemCreate, orderRefundCreate };
}

describe('OrdersService.refundOrder (mixed model)', () => {
  it('money-only refund does not restore inventory', async () => {
    const { service, prisma, restore, orderRefundItemCreate, orderRefundCreate } = buildService();
    prisma.order.findFirst.mockResolvedValue(buildOrder());

    await service.refundOrder('order-1', { amount: 50, refundMethod: 'CASH', reason: 'x' });

    expect(restore).not.toHaveBeenCalled();
    expect(orderRefundItemCreate).not.toHaveBeenCalled();
    expect(orderRefundCreate.mock.calls[0][0].data.restoreInventory).toBe(false);
  });

  it('item-level refund restores exactly the refunded lines and derives the amount', async () => {
    const { service, prisma, restore, orderRefundItemCreate, orderRefundCreate } = buildService();
    prisma.order.findFirst.mockResolvedValue(buildOrder());

    await service.refundOrder('order-1', {
      refundMethod: 'CASH',
      reason: 'línea dañada',
      items: [{ orderItemId: 'oi1', quantity: 1 }],
    });

    // unit price of oi1 = 160/2 = 80 → refund amount 80
    expect(orderRefundCreate.mock.calls[0][0].data.amount).toBe(80);
    expect(orderRefundCreate.mock.calls[0][0].data.restoreInventory).toBe(true);
    expect(orderRefundItemCreate).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore.mock.calls[0][1]).toEqual([{ productId: 'p1', quantity: 1, itemType: 'PRODUCT' }]);
  });

  it('rejects refunding more units of a line than remain (no double restore)', async () => {
    const { service, prisma } = buildService();
    // oi1 sold 2, already fully refunded 2 in a prior refund.
    prisma.order.findFirst.mockResolvedValue(
      buildOrder({ refunds: [{ amount: 160, items: [{ orderItemId: 'oi1', quantity: 2 }] }] }),
    );

    await expect(
      service.refundOrder('order-1', {
        refundMethod: 'CASH',
        reason: 'otra vez',
        items: [{ orderItemId: 'oi1', quantity: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a second partial refund up to the remaining quantity', async () => {
    const { service, prisma, restore } = buildService();
    // oi1 sold 2, 1 already refunded → 1 remaining.
    prisma.order.findFirst.mockResolvedValue(
      buildOrder({ refunds: [{ amount: 80, items: [{ orderItemId: 'oi1', quantity: 1 }] }] }),
    );

    await service.refundOrder('order-1', {
      refundMethod: 'CASH',
      reason: 'segunda parcial',
      items: [{ orderItemId: 'oi1', quantity: 1 }],
    });

    expect(restore).toHaveBeenCalledTimes(1);
  });

  it('rejects when amount disagrees with the line total', async () => {
    const { service, prisma } = buildService();
    prisma.order.findFirst.mockResolvedValue(buildOrder());

    await expect(
      service.refundOrder('order-1', {
        amount: 50,
        refundMethod: 'CASH',
        reason: 'mismatch',
        items: [{ orderItemId: 'oi1', quantity: 1 }], // lines = 80
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

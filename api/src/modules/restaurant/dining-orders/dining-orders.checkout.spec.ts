import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DiningOrdersService } from './dining-orders.service';

/**
 * Tests for DiningOrdersService.checkout: the path that turns a dining order into
 * a financial Order. Covers idempotency, payable-state guard, cash coverage and
 * delegation to the inventory + checkout engines. Service built directly with
 * mocks to avoid Nest DI noise.
 */

const TENANT = 'tenant-1';
const BRANCH = 'branch-1';

function diningOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'do-1',
    status: 'DELIVERED',
    orderId: null,
    tableId: 'table-1',
    reference: 'Mesa 5',
    table: { name: 'Mesa 5' },
    waiter: { firstName: 'Ana', lastName: 'López' },
    items: [
      { productId: 'p1', productName: 'Burger', unitPrice: 80, quantity: 2, notes: null },
      { productId: 'p2', productName: 'Papas', unitPrice: 40, quantity: 1, notes: null },
    ],
    ...overrides,
  };
}

function build() {
  const consume = jest.fn();
  const createPayments = jest.fn();
  const createCashMovements = jest.fn();
  const resolveActiveCashSession = jest.fn().mockResolvedValue({ id: 'sess-1' });

  const tx = {
    diningOrder: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    order: {
      create: jest.fn().mockResolvedValue({ id: 'order-1' }),
      // Payload de impresión del ticket: cabecera + líneas + pagos.
      findUnique: jest.fn().mockResolvedValue({
        id: 'order-1', orderNumber: 'C-123', status: 'DELIVERED', paymentStatus: 'PAID',
        total: 200, tableNumber: 'Mesa 5', employeeNumber: 'Ana López',
        items: [{ name: 'Burger', quantity: 2, price: 80 }, { name: 'Papas', quantity: 1, price: 40 }],
        payments: [{ paymentMethod: 'CASH', amount: 200, status: 'PAID' }],
      }),
    },
    orderItem: { create: jest.fn().mockResolvedValue({}) },
    restaurantTable: { update: jest.fn().mockResolvedValue({}) },
  };

  const prisma = {
    // assertBranchBelongs: por defecto la sucursal pertenece al tenant.
    branch: { findFirst: jest.fn().mockResolvedValue({ id: BRANCH }) },
    diningOrder: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn() },
    // isKitchenEnabled() consulta el tenant; null ⇒ cocina deshabilitada, así el
    // checkout no exige enviar rondas (estos casos cobran una cuenta DELIVERED).
    tenant: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new DiningOrdersService(
    prisma as never,
    { requireTenantId: () => TENANT } as never,
    { getUserId: () => 'user-1' } as never,
    { consume, restore: jest.fn(), validate: jest.fn() } as never,
    { resolveActiveCashSession, createPayments, createCashMovements } as never,
    { resolveRestaurantVisibilityMode: jest.fn().mockResolvedValue('SHARED'), assertCanAccessOrder: jest.fn().mockResolvedValue(undefined) } as never,
  );

  return { service, prisma, tx, consume, createPayments, createCashMovements, resolveActiveCashSession };
}

const fullPayment = { payments: [{ paymentMethod: 'CASH', amount: 200 }] };

describe('DiningOrdersService.checkout', () => {
  it('rejects when order not found', async () => {
    const { service, prisma } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(null);
    await expect(service.checkout(BRANCH, 'do-1', fullPayment)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when branch does not belong to the tenant (cross-tenant)', async () => {
    const { service, prisma } = build();
    prisma.branch.findFirst.mockResolvedValue(null); // sucursal de otro tenant
    await expect(service.checkout(BRANCH, 'do-1', fullPayment)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.diningOrder.findFirst).not.toHaveBeenCalled(); // frena antes de tocar datos
  });

  it('rejects when already charged (orderId present) — idempotency', async () => {
    const { service, prisma } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder({ orderId: 'order-prev' }));
    await expect(service.checkout(BRANCH, 'do-1', fullPayment)).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when status is not payable', async () => {
    const { service, prisma } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder({ status: 'OPEN' }));
    await expect(service.checkout(BRANCH, 'do-1', fullPayment)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when payment does not cover the total', async () => {
    const { service, prisma } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder());
    await expect(
      service.checkout(BRANCH, 'do-1', { payments: [{ paymentMethod: 'CASH', amount: 100 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects (concurrency) when the optimistic link finds it already charged', async () => {
    const { service, prisma, tx } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder());
    tx.diningOrder.updateMany.mockResolvedValue({ count: 0 }); // someone charged it first
    await expect(service.checkout(BRANCH, 'do-1', fullPayment)).rejects.toBeInstanceOf(ConflictException);
  });

  it('charges: creates Order + items, consumes inventory, records payment, links + releases table', async () => {
    const { service, prisma, tx, consume, createPayments, createCashMovements } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder());

    await service.checkout(BRANCH, 'do-1', fullPayment);

    // Order header
    const orderData = tx.order.create.mock.calls[0][0].data;
    expect(orderData.orderOrigin).toBe('RESTAURANT_COMANDA');
    expect(Number(orderData.total)).toBe(200);
    expect(orderData.tableNumber).toBe('Mesa 5');
    expect(orderData.employeeNumber).toBe('Ana López');
    expect(orderData.paymentStatus).toBe('PAID');

    // Items mapped
    expect(tx.orderItem.create).toHaveBeenCalledTimes(2);

    // Inventory consumed against the new order
    expect(consume).toHaveBeenCalledTimes(1);
    const consumeCtx = consume.mock.calls[0][2];
    expect(consumeCtx).toEqual(expect.objectContaining({ referenceId: 'order-1', referenceType: 'ORDER' }));

    // Financial footprint
    expect(createPayments).toHaveBeenCalledTimes(1);
    expect(createCashMovements).toHaveBeenCalledTimes(1);

    // Linked + table released
    expect(tx.diningOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderId: 'order-1' }) }),
    );
    expect(tx.restaurantTable.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'AVAILABLE' } }),
    );
  });

  it('validates customer when customerId provided', async () => {
    const { service, prisma } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder());
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.checkout(BRANCH, 'do-1', { ...fullPayment, customerId: 'cust-x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ticket: devuelve la orden con líneas y pagos (payload de impresión)', async () => {
    const { service, prisma, tx } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder());

    const ticket = await service.checkout(BRANCH, 'do-1', fullPayment) as {
      orderNumber: string; items: unknown[]; payments: unknown[];
    };

    // La recarga final incluye items + payments: todo lo que el cliente imprime.
    expect(tx.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ include: { items: true, payments: true } }),
    );
    expect(ticket.orderNumber).toBe('C-123');
    expect(ticket.items).toHaveLength(2);
    expect(ticket.payments).toHaveLength(1);
  });

  it('rollback: si falla el consumo de inventario, no se escribe el footprint financiero', async () => {
    const { service, prisma, tx, consume, createPayments, createCashMovements } = build();
    prisma.diningOrder.findFirst.mockResolvedValue(diningOrder());
    // Inventario insuficiente a mitad de la transacción.
    consume.mockRejectedValue(new BadRequestException('Stock insuficiente'));

    await expect(service.checkout(BRANCH, 'do-1', fullPayment)).rejects.toBeInstanceOf(BadRequestException);

    // El error se lanza DENTRO del $transaction (Prisma revierte order.create y el
    // lock). Como prueba de atomicidad: el footprint financiero posterior nunca corre.
    expect(tx.order.create).toHaveBeenCalledTimes(1); // alcanzó a crear (será revertido)
    expect(createPayments).not.toHaveBeenCalled();
    expect(createCashMovements).not.toHaveBeenCalled();
    expect(tx.restaurantTable.update).not.toHaveBeenCalled(); // mesa NO se libera
  });
});

import { BadRequestException } from '@nestjs/common';

import { ReceivablesService } from './receivables.service';

/**
 * P1-01 — Caja multi-sucursal (Retail).
 *
 * El pago de una CxC debe registrar su CashMovement contra la CashSession de la
 * sucursal del cobro (tenant + branch + ABIERTA). Antes el lookup omitía branchId
 * y el pago caía en cualquier caja abierta del tenant → cruce entre sucursales.
 */

const TENANT = 'tenant-1';

/**
 * Service con dos sucursales con caja ABIERTA (A y B). El lookup dentro de la
 * transacción enruta por branchId; devuelve null si la sucursal no tiene caja.
 */
function build(branchId: string | null) {
  const sessionsByBranch: Record<string, { id: string }> = {
    'branch-A': { id: 'cs-A' },
    'branch-B': { id: 'cs-B' },
  };

  const record = { id: 'ar-1', balance: 500, status: 'PENDIENTE', orderId: 'o-1' };

  const sessionFindFirst = jest.fn(
    ({ where }: { where: { branchId?: string } }) =>
      Promise.resolve(where.branchId ? (sessionsByBranch[where.branchId] ?? null) : null),
  );
  const cashMovementCreate = jest.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'cm-1', ...args.data }),
  );

  const tx = {
    accountReceivablePayment: { create: jest.fn().mockResolvedValue({ id: 'arp-1' }) },
    order: { update: jest.fn().mockResolvedValue({}) },
    cashSession: { findFirst: sessionFindFirst },
    cashMovement: { create: cashMovementCreate },
    accountReceivable: {
      update: jest.fn().mockResolvedValue({ id: 'ar-1', balance: 300, status: 'PARCIAL' }),
    },
  };

  const prisma = {
    accountReceivable: { findFirst: jest.fn().mockResolvedValue(record) },
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };

  const service = new ReceivablesService(
    prisma as never,
    { requireTenantId: () => TENANT, getBranchId: () => branchId } as never,
    { getUserId: () => 'user-1' } as never,
  );

  return { service, sessionFindFirst, cashMovementCreate };
}

const dto = { amount: 200, paymentMethod: 'CASH' };

describe('ReceivablesService.registerPayment (P1-01 — multi-sucursal)', () => {
  it('dos sucursales abiertas: el pago en la sucursal B usa la caja de B (no la de A)', async () => {
    const { service, sessionFindFirst, cashMovementCreate } = build('branch-B');

    await service.registerPayment('ar-1', dto);

    expect(sessionFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT, branchId: 'branch-B', status: 'ABIERTA' } }),
    );
    expect(cashMovementCreate.mock.calls[0][0].data.cashSessionId).toBe('cs-B');
  });

  it('pago en la sucursal A usa la caja de A', async () => {
    const { service, cashMovementCreate } = build('branch-A');
    await service.registerPayment('ar-1', dto);
    expect(cashMovementCreate.mock.calls[0][0].data.cashSessionId).toBe('cs-A');
  });

  // Antes el cobro se registraba con `cashSessionId: null`: el saldo del cliente
  // bajaba y el efectivo no entraba a ningún corte. Ahora se rechaza (CASH-001).
  it('sucursal sin caja abierta: rechaza el cobro en vez de dejarlo huérfano', async () => {
    const { service, cashMovementCreate } = build('branch-sin-caja');

    await expect(service.registerPayment('ar-1', dto)).rejects.toThrow(BadRequestException);
    expect(cashMovementCreate).not.toHaveBeenCalled();
  });
});

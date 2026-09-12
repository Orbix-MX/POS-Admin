/**
 * Aritmética de la devolución.
 *
 * Devolver de más saca dinero del cajón que nunca entró, y devolver de menos
 * deja al cliente sin parte de lo suyo. Las dos son errores que el corte
 * arrastra hasta el final del turno.
 */
import type { Order } from '@/repositories/orders-repository';

import { refundAmountOf, refundableUnits } from './refund-sheet';

jest.mock('@/services/api', () => ({ http: {} }));

function line(overrides: Partial<Order['lines'][number]> = {}): Order['lines'][number] {
  return {
    id: 'item-1',
    productId: 'p-1',
    variantId: null,
    name: 'Playera',
    sku: 'PLA',
    quantity: 3,
    price: 100,
    discount: 0,
    tax: 48,
    total: 348,
    refundedQuantity: 0,
    ...overrides,
  };
}

function order(lines: Order['lines']): Order {
  return {
    id: 'o-1',
    orderNumber: 'V-1',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    origin: 'RETAIL_POS',
    subtotal: 0,
    tax: 0,
    discount: 0,
    total: 0,
    notes: null,
    branchId: null,
    customerId: null,
    customerName: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: '2026-09-11T15:00:00.000Z',
    lines,
    payments: [],
    refunds: [],
    refundedAmount: 0,
  };
}

describe('refundableUnits', () => {
  it('todas las unidades cuando no se devolvió nada', () => {
    expect(refundableUnits(line())).toBe(3);
  });

  it('descuenta lo ya devuelto', () => {
    expect(refundableUnits(line({ refundedQuantity: 2 }))).toBe(1);
  });

  it('cero cuando ya se devolvió todo', () => {
    expect(refundableUnits(line({ refundedQuantity: 3 }))).toBe(0);
  });

  it('nunca es negativo, aunque los datos vengan raros', () => {
    expect(refundableUnits(line({ refundedQuantity: 5 }))).toBe(0);
  });
});

describe('refundAmountOf', () => {
  it('prorratea el total de la línea por unidad', () => {
    // 348 por 3 unidades = 116 cada una.
    expect(refundAmountOf(order([line()]), { 'item-1': 1 })).toBe(116);
    expect(refundAmountOf(order([line()]), { 'item-1': 2 })).toBe(232);
  });

  it('devuelve el total de la línea al devolverla entera', () => {
    expect(refundAmountOf(order([line()]), { 'item-1': 3 })).toBe(348);
  });

  it('usa el total cobrado, no el precio de catálogo', () => {
    // Vendida con descuento: 3×100 − 60 de descuento + impuesto = 288.
    // Devolver el precio de lista sacaría del cajón más de lo que entró.
    const discounted = line({ discount: 60, total: 288 });
    expect(refundAmountOf(order([discounted]), { 'item-1': 3 })).toBe(288);
    expect(refundAmountOf(order([discounted]), { 'item-1': 1 })).toBe(96);
  });

  it('suma varias líneas', () => {
    const lines = [line(), line({ id: 'item-2', quantity: 2, total: 174 })];
    // 1×116 + 2×87 = 290
    expect(refundAmountOf(order(lines), { 'item-1': 1, 'item-2': 2 })).toBe(290);
  });

  it('ignora las líneas no elegidas', () => {
    const lines = [line(), line({ id: 'item-2', quantity: 2, total: 174 })];
    expect(refundAmountOf(order(lines), { 'item-2': 1 })).toBe(87);
  });

  it('sin selección no devuelve nada', () => {
    expect(refundAmountOf(order([line()]), {})).toBe(0);
  });

  it('ignora cantidades en cero o negativas', () => {
    expect(refundAmountOf(order([line()]), { 'item-1': 0 })).toBe(0);
    expect(refundAmountOf(order([line()]), { 'item-1': -1 })).toBe(0);
  });

  it('redondea a dos decimales — es dinero, no un float suelto', () => {
    // 100 entre 3 unidades = 33.333…; una unidad devuelve 33.33.
    const odd = line({ quantity: 3, total: 100 });
    expect(refundAmountOf(order([odd]), { 'item-1': 1 })).toBe(33.33);
    expect(refundAmountOf(order([odd]), { 'item-1': 2 })).toBe(66.67);
  });

  it('no divide entre cero si una línea viniera con cantidad cero', () => {
    const broken = line({ quantity: 0, total: 0 });
    expect(refundAmountOf(order([broken]), { 'item-1': 1 })).toBe(0);
  });
});

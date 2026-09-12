/**
 * El mapeo DTO → dominio de una venta.
 *
 * Lo importante aquí es `refundedQuantity`: el servidor acota cada devolución
 * nueva por (vendido − ya devuelto), así que si la UI calcula mal ese resto
 * ofrece cantidades que la API rechazará — o, peor, esconde unidades que
 * todavía se pueden devolver.
 */
import type { OrderDto } from '@/dto/orders.dto';

import { toDomain } from './orders-repository';

// Se eleva por encima de los imports: el módulo de arriba se resuelve ya con
// el transporte mockeado. Estas pruebas son del mapeo, no de la red.
jest.mock('@/services/api', () => ({ http: {} }));

function saleDto(): OrderDto {
  return {
    id: 'order-1',
    orderNumber: 'V-000123',
    status: 'CONFIRMED',
    paymentStatus: 'PAID',
    orderOrigin: 'RETAIL_POS',
    subtotal: '450.00',
    tax: '72.00',
    discount: '0.00',
    total: '522.00',
    notes: null,
    branchId: 'branch-1',
    customerId: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: '2026-09-11T15:30:00.000Z',
    items: [
      {
        id: 'item-1',
        itemType: 'PRODUCT',
        productId: 'prod-1',
        variantId: 'var-1',
        name: 'Playera — Talla M',
        sku: 'PLA-M',
        quantity: 3,
        price: '100.00',
        discount: '0.00',
        tax: '48.00',
        subtotal: '300.00',
        total: '348.00',
      },
      {
        id: 'item-2',
        itemType: 'PRODUCT',
        productId: 'prod-2',
        variantId: null,
        name: 'Refresco 600 ml',
        sku: 'REF-600',
        quantity: 2,
        price: '75.00',
        discount: '0.00',
        tax: '24.00',
        subtotal: '150.00',
        total: '174.00',
      },
    ],
    payments: [
      {
        id: 'pay-1',
        paymentMethod: 'CASH',
        currency: 'MXN',
        amount: '522.00',
        amountReceived: '600.00',
        changeGiven: '78.00',
        changeCurrency: 'MXN',
        status: 'PAID',
        createdAt: '2026-09-11T15:30:00.000Z',
      },
    ],
    refunds: [],
  };
}

describe('toDomain', () => {
  it('convierte los Decimal que llegan como string', () => {
    const order = toDomain(saleDto());

    expect(order.subtotal).toBe(450);
    expect(order.tax).toBe(72);
    expect(order.total).toBe(522);
    expect(order.lines[0]?.price).toBe(100);
    expect(order.payments[0]?.changeGiven).toBe(78);
  });

  it('conserva variantId — es la unidad vendible, no el producto', () => {
    const order = toDomain(saleDto());

    expect(order.lines[0]?.variantId).toBe('var-1');
    expect(order.lines[1]?.variantId).toBeNull();
  });

  it('deja refundedQuantity en cero cuando no hay devoluciones', () => {
    const order = toDomain(saleDto());

    expect(order.lines.map((l) => l.refundedQuantity)).toEqual([0, 0]);
    expect(order.refundedAmount).toBe(0);
  });

  it('suma las unidades devueltas por línea a través de varias devoluciones', () => {
    const order = toDomain({
      ...saleDto(),
      paymentStatus: 'PARTIALLY_REFUNDED',
      refunds: [
        {
          id: 'ref-1',
          amount: '116.00',
          currency: 'MXN',
          refundMethod: 'CASH',
          originalMethod: 'CASH',
          reason: 'Talla equivocada',
          notes: null,
          createdAt: '2026-09-11T18:00:00.000Z',
          items: [{ id: 'ri-1', orderItemId: 'item-1', productId: 'prod-1', quantity: 1 }],
        },
        {
          id: 'ref-2',
          amount: '116.00',
          currency: 'MXN',
          refundMethod: 'CASH',
          originalMethod: 'CASH',
          reason: 'Defecto',
          notes: null,
          createdAt: '2026-09-11T19:00:00.000Z',
          items: [{ id: 'ri-2', orderItemId: 'item-1', productId: 'prod-1', quantity: 1 }],
        },
      ],
    });

    const playera = order.lines.find((l) => l.id === 'item-1');
    // Dos devoluciones de 1 unidad cada una sobre la misma línea: quedan 3−2=1.
    expect(playera?.refundedQuantity).toBe(2);
    expect(playera && playera.quantity - playera.refundedQuantity).toBe(1);

    // La otra línea no se toca.
    expect(order.lines.find((l) => l.id === 'item-2')?.refundedQuantity).toBe(0);

    expect(order.refundedAmount).toBe(232);
  });

  it('ignora las devoluciones solo de dinero al contar unidades', () => {
    const order = toDomain({
      ...saleDto(),
      refunds: [
        {
          id: 'ref-3',
          amount: '50.00',
          currency: 'MXN',
          refundMethod: 'CASH',
          originalMethod: 'CASH',
          reason: 'Ajuste de precio',
          notes: null,
          createdAt: '2026-09-11T20:00:00.000Z',
          // Sin `items`: no restaura inventario, solo devuelve dinero.
        },
      ],
    });

    expect(order.lines.every((l) => l.refundedQuantity === 0)).toBe(true);
    expect(order.refundedAmount).toBe(50);
  });

  it('compone el nombre del cliente y acepta la venta de mostrador', () => {
    expect(toDomain(saleDto()).customerName).toBeNull();

    const conCliente = toDomain({
      ...saleDto(),
      customerId: 'cust-1',
      customer: {
        id: 'cust-1',
        firstName: 'Ana',
        lastName: 'Ruiz',
        email: 'ana@correo.com',
        phone: null,
      },
    });
    expect(conCliente.customerName).toBe('Ana Ruiz');
  });

  it('cae al correo cuando el cliente no tiene nombre', () => {
    const order = toDomain({
      ...saleDto(),
      customer: { id: 'c', firstName: '', lastName: '', email: 'sin-nombre@correo.com', phone: null },
    });

    expect(order.customerName).toBe('sin-nombre@correo.com');
  });

  it('sobrevive a la fila pelada del listado, sin relaciones', () => {
    const dto = saleDto();
    delete dto.items;
    delete dto.payments;
    delete dto.refunds;

    const order = toDomain(dto);

    expect(order.lines).toEqual([]);
    expect(order.payments).toEqual([]);
    expect(order.refunds).toEqual([]);
    expect(order.refundedAmount).toBe(0);
    expect(order.total).toBe(522);
  });

  it('lee el motivo de una venta cancelada', () => {
    const order = toDomain({
      ...saleDto(),
      status: 'CANCELLED',
      cancelledAt: '2026-09-11T21:00:00.000Z',
      cancellationReason: 'Cobro duplicado',
    });

    expect(order.status).toBe('CANCELLED');
    expect(order.cancellationReason).toBe('Cobro duplicado');
  });
});

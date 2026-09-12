/**
 * Qué productos pueden mover existencias.
 *
 * El servidor rechaza el ajuste de un RECIPE/COMBO/SERVICE y el de cualquier
 * producto con `trackInventory: false`, pero el motivo no es obvio desde la
 * pantalla: sin esta comprobación el usuario ve un 400 genérico tras teclear
 * las unidades.
 */
import type { Product } from '@/repositories/products-repository';
import { ProductStatus, ProductType, TaxCode } from '@/types/api';

import { stockAdjustmentBlocker } from './use-stock-adjustment';


// Se eleva por encima de los imports, así que el repositorio ya está mockeado
// cuando se resuelve el de arriba. El transporte no pinta nada en esta regla.
jest.mock('@/services/api', () => ({ http: {} }));

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1',
    sku: 'SKU-1',
    name: 'Producto',
    slug: 'producto',
    description: '',
    price: 100,
    comparePrice: null,
    costPrice: null,
    type: ProductType.SIMPLE,
    categoryId: null,
    categoryName: null,
    status: ProductStatus.ACTIVE,
    stock: 10,
    trackInventory: true,
    lowStockAlert: 5,
    taxRate: 16,
    taxCode: TaxCode.IVA_16,
    isEcommerce: false,
    images: [],
    primaryImage: null,
    variants: [],
    createdAt: '2026-09-11T00:00:00.000Z',
    ...overrides,
  };
}

function variant(id: string, name: string) {
  return { id, name, sku: '', barcode: '', cost: 0, price: 100, stock: 4 };
}

describe('stockAdjustmentBlocker', () => {
  it('deja ajustar un producto simple con inventario', () => {
    expect(stockAdjustmentBlocker(product())).toBeNull();
  });

  it('bloquea un producto que no lleva control de existencias', () => {
    expect(stockAdjustmentBlocker(product({ trackInventory: false }))).toBe('untracked');
  });

  it.each([ProductType.RECIPE, ProductType.COMBO, ProductType.SERVICE] as const)(
    'bloquea un %s sin presentaciones — su existencia sale de los ingredientes',
    (type) => {
      expect(stockAdjustmentBlocker(product({ type }))).toBe('type');
    },
  );

  it('deja ajustar por presentación aunque el tipo no sea SIMPLE', () => {
    // Con variantes el ajuste va por `/variants/:id/stock`, que sí las acepta
    // mientras la variante siga inventariándose.
    expect(
      stockAdjustmentBlocker(
        product({ type: ProductType.COMBO, variants: [variant('v-1', 'Chico')] }),
      ),
    ).toBeNull();
  });

  it('"sin inventario" gana sobre el tipo — es la razón más útil de mostrar', () => {
    expect(
      stockAdjustmentBlocker(product({ type: ProductType.RECIPE, trackInventory: false })),
    ).toBe('untracked');
  });
});

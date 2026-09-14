import { cartLineKey, computeTotals, type CartLine } from './pos-totals';

function line(over: Partial<CartLine> = {}): CartLine {
  return {
    productId: 'p1',
    variantId: null,
    name: 'Refresco',
    sku: 'REF',
    price: 10,
    quantity: 1,
    stock: 100,
    trackInventory: true,
    taxRate: null,
    ...over,
  };
}

/**
 * La identidad de una línea del carrito.
 *
 * Importa desde que existe el escáner: la cámara sabe qué presentación leyó y
 * la retícula no. Si las dos produjeran la misma clave, escanear la etiqueta de
 * los 2 L sumaría una unidad a la línea del de 600 ml y se cobraría el precio
 * equivocado.
 */
describe('cartLineKey', () => {
  it('un producto sin presentación se identifica por su id', () => {
    expect(cartLineKey({ productId: 'p1', variantId: null })).toBe('p1');
  });

  it('dos presentaciones del mismo producto son dos líneas', () => {
    const a = cartLineKey({ productId: 'p1', variantId: 'v1' });
    const b = cartLineKey({ productId: 'p1', variantId: 'v2' });
    expect(a).not.toBe(b);
  });

  it('una presentación concreta no se confunde con "la default"', () => {
    // Tocar la tarjeta deja `variantId` null y deja que el servidor resuelva;
    // escanear una etiqueta elige una. No son lo mismo y no deben sumarse.
    expect(cartLineKey({ productId: 'p1', variantId: 'v1' })).not.toBe(
      cartLineKey({ productId: 'p1', variantId: null }),
    );
  });

  it('la misma presentación siempre da la misma clave', () => {
    expect(cartLineKey({ productId: 'p1', variantId: 'v1' })).toBe(
      cartLineKey({ productId: 'p1', variantId: 'v1' }),
    );
  });

  it('no cruza productos distintos que compartan id de presentación', () => {
    expect(cartLineKey({ productId: 'p1', variantId: 'v1' })).not.toBe(
      cartLineKey({ productId: 'p2', variantId: 'v1' }),
    );
  });
});

describe('computeTotals', () => {
  it('un carrito vacío no cuesta nada', () => {
    expect(computeTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0, itemCount: 0 });
  });

  it('suma el precio por cantidad', () => {
    const totals = computeTotals([line({ price: 10, quantity: 3 })]);
    expect(totals.subtotal).toBe(30);
    expect(totals.total).toBe(30);
    expect(totals.itemCount).toBe(3);
  });

  it('cobra el precio de cada presentación, no uno común', () => {
    // Es el caso que destapa el escáner: dos líneas del mismo producto con
    // precios distintos porque son presentaciones distintas.
    const totals = computeTotals([
      line({ variantId: 'v1', price: 18, quantity: 1 }),
      line({ variantId: 'v2', price: 32, quantity: 2 }),
    ]);
    expect(totals.subtotal).toBe(82);
    expect(totals.itemCount).toBe(3);
  });

  it('aplica el impuesto de cada línea por separado', () => {
    const totals = computeTotals([
      line({ price: 100, quantity: 1, taxRate: 16 }),
      line({ productId: 'p2', price: 50, quantity: 1, taxRate: null }),
    ]);
    expect(totals.subtotal).toBe(150);
    // Solo la primera lleva tasa: la segunda la resuelve el servidor y aquí
    // aporta 0, que es lo que el encabezado del módulo advierte.
    expect(totals.tax).toBe(16);
    expect(totals.total).toBe(166);
  });

  it('redondea a dos decimales como el servidor', () => {
    const totals = computeTotals([line({ price: 0.1, quantity: 3 })]);
    // 0.1 * 3 en punto flotante es 0.30000000000000004.
    expect(totals.subtotal).toBe(0.3);
  });

  it('una tasa de 0 no suma impuesto', () => {
    const totals = computeTotals([line({ price: 100, taxRate: 0 })]);
    expect(totals.tax).toBe(0);
  });
});

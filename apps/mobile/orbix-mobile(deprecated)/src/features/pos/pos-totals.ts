/**
 * Cart shape and money math for the POS screen.
 *
 * The tax preview mirrors `OrdersService.create` as closely as the client can:
 * the server resolves each line's rate as `product.taxRate ?? tenant.settings
 * .defaultTaxRate` and rounds per line. `defaultTaxRate` is not exposed to the
 * client, so a product with a null `taxRate` contributes 0 here and the preview
 * understates the tax the server will actually charge. Anything the user is
 * shown *after* the sale comes from the server's own `subtotal`/`tax`/`total`.
 */
import { currencyFormatStore } from '@/services/currency/currency-format-store';

export interface CartLine {
  productId: string;
  /**
   * Presentación vendida. `null` significa "la default, que resuelve el
   * servidor" — es lo que produce tocar una tarjeta de la retícula, que no sabe
   * de presentaciones.
   *
   * Existe porque el escáner sí sabe cuál leyó: sin esto, escanear la etiqueta
   * de los 2 L cobraría el precio del refresco de 600 ml y descontaría la
   * existencia de la presentación equivocada.
   */
  variantId: string | null;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  stock: number;
  trackInventory: boolean;
  /** Percent, as stored on the product (e.g. `16`). Null → server default applies. */
  taxRate: number | null;
}

/**
 * La identidad de una línea del carrito.
 *
 * No es `productId`: dos presentaciones del mismo producto son dos artículos
 * distintos, con su precio y su existencia. Agruparlas sumaría cantidades de
 * cosas que no se cobran igual.
 */
export function cartLineKey(line: Pick<CartLine, 'productId' | 'variantId'>): string {
  return line.variantId ? `${line.productId}:${line.variantId}` : line.productId;
}

export interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
}

/** Two-decimal rounding, matching the API's `roundMoney`. */
function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeTotals(lines: CartLine[]): CartTotals {
  let subtotal = 0;
  let tax = 0;
  let itemCount = 0;

  for (const line of lines) {
    const lineSubtotal = roundMoney(line.price * line.quantity);
    subtotal += lineSubtotal;
    if (line.taxRate != null && line.taxRate > 0) {
      tax += roundMoney(lineSubtotal * (line.taxRate / 100));
    }
    itemCount += line.quantity;
  }

  subtotal = roundMoney(subtotal);
  tax = roundMoney(tax);

  return { subtotal, tax, total: roundMoney(subtotal + tax), itemCount };
}

/** Tenant's real currency + decimal preference — see `CurrencyFormatSync`. */
export function formatCurrency(value: number): string {
  return currencyFormatStore.format(value);
}

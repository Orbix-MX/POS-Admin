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

export interface CartLine {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  stock: number;
  trackInventory: boolean;
  /** Percent, as stored on the product (e.g. `16`). Null → server default applies. */
  taxRate: number | null;
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

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

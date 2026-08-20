import type { Product } from '~/services/orbix'
import type { CartLine } from '~/stores/cart-store'

/**
 * Vista previa de los totales de la venta.
 *
 * IMPORTANTE — esto NO es la fuente de verdad. Los importes que se cobran y se
 * asientan los calcula el backend en `orders.service.ts` al crear la orden; lo
 * que hay aquí es un espejo de esa aritmética para poder pintar el desglose
 * (Subtotal / Descuento / IVA / Total) *antes* de enviar la orden, que es lo que
 * pide el diseño. Tras crear la venta, la pantalla de ticket muestra los
 * importes que devolvió el servidor, no estos.
 *
 * La aritmética replicada (ver `api/src/modules/retail/orders/orders.service.ts`
 * y `api/src/common/utils/money.util.ts`):
 *
 *   subtotal       = Σ price × qty
 *   lineSubtotal   = max(0, price × qty − lineDiscount)
 *   lineTax        = lineSubtotal × taxRate / 100     (0 para servicios)
 *   taxRate        = product.taxRate ?? tenant.settings.defaultTaxRate
 *   discountAmount = Σ lineDiscount
 *   total          = max(0, subtotal − discountAmount + tax)
 */

export const roundMoney = (value: number): number =>
  Number.isFinite(value) ? Math.round((value + Number.EPSILON) * 100) / 100 : 0

export const sumMoney = (values: number[]): number => roundMoney(values.reduce((acc, v) => acc + v, 0))

export const lineSubtotal = (price: number, quantity: number, discount = 0): number =>
  roundMoney(Math.max(0, price * quantity - discount))

export const lineTax = (base: number, ratePercent?: number | null): number =>
  !ratePercent || ratePercent <= 0 ? 0 : roundMoney(base * (ratePercent / 100))

export interface OrderTotalsPreview {
  subtotal: number
  discount: number
  tax: number
  total: number
  /** Tasa efectiva, solo para rotular la línea de IVA cuando es homogénea. */
  effectiveTaxRate: number | null
  itemCount: number
}

export interface TotalsContext {
  productsById: Map<string, Product>
  defaultTaxRate: number
}

function resolveTaxRate(line: CartLine, ctx: TotalsContext): number {
  if (line.type === 'SERVICE') return 0
  const product = ctx.productsById.get(line.productId)
  return product?.taxRate != null ? Number(product.taxRate) : ctx.defaultTaxRate
}

export function previewTotals(lines: CartLine[], ctx: TotalsContext): OrderTotalsPreview {
  const subtotal = sumMoney(lines.map((l) => l.unitPrice * l.qty))

  const rates = new Set<number>()
  let tax = 0
  let discount = 0

  for (const line of lines) {
    const d = roundMoney(line.discount ?? 0)
    discount += d
    const base = lineSubtotal(line.unitPrice, line.qty, d)
    const rate = resolveTaxRate(line, ctx)
    if (line.type === 'PRODUCT') rates.add(rate)
    tax += lineTax(base, rate)
  }

  discount = roundMoney(discount)
  tax = roundMoney(tax)

  return {
    subtotal,
    discount,
    tax,
    total: roundMoney(Math.max(0, subtotal - discount + tax)),
    effectiveTaxRate: rates.size === 1 ? [...rates][0] : null,
    itemCount: lines.reduce((acc, l) => acc + l.qty, 0),
  }
}

/**
 * Reparte un descuento sobre la venta entre las líneas, proporcional al importe
 * de cada una. El backend solo acepta descuento por línea (`item.discount`) y
 * cupones; distribuir aquí es composición sobre el contrato existente, no una
 * regla de negocio nueva — el servidor sigue siendo quien lo aplica y lo suma
 * a `order.discount`. El redondeo se ajusta en la última línea para que la suma
 * cuadre exactamente con el monto pedido.
 */
export function distributeOrderDiscount(lines: CartLine[], orderDiscount: number): Map<string, number> {
  const result = new Map<string, number>()
  const target = roundMoney(Math.max(0, orderDiscount))
  if (target === 0 || lines.length === 0) return result

  const gross = lines.map((l) => roundMoney(l.unitPrice * l.qty))
  const grossTotal = sumMoney(gross)
  if (grossTotal <= 0) return result

  const capped = Math.min(target, grossTotal)
  let assigned = 0

  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1
    const share = isLast ? roundMoney(capped - assigned) : roundMoney((gross[i] / grossTotal) * capped)
    const bounded = Math.min(share, gross[i])
    assigned = roundMoney(assigned + bounded)
    if (bounded > 0) result.set(line.key, bounded)
  })

  return result
}

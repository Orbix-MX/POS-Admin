/** Formateo monetario del POS. Misma convención que el Admin Web (es-MX / MXN). */

export const money = (n: number): string =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number.isFinite(n) ? n : 0)

/** Sin símbolo — para los displays grandes donde el `$` va aparte, como en el diseño. */
export const amount = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const usd = (n: number): string =>
  `$${(Number.isFinite(n) ? n : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`

/** Redondeo a centavos: evita que los flotantes arrastren ruido al backend. */
export const round2 = (n: number): number => Math.round(n * 100) / 100

export const toNumber = (raw: string): number => {
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

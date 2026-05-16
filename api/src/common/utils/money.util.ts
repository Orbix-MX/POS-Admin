/**
 * Centralized monetary arithmetic. All money values flow through here so
 * rounding is consistent across orders, cash, CxC, CxP and exchange rates.
 *
 * Strategy: round to 2 decimals using integer-cents to dodge binary-float
 * drift (e.g. 0.1 + 0.2). No external dependency.
 */

/** Round a monetary amount to 2 decimals. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sum a list of amounts, rounding the result. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((acc, v) => acc + v, 0));
}

/** Multiply price by quantity, rounded. */
export function multiplyMoney(price: number, quantity: number): number {
  return roundMoney(price * quantity);
}

/** Convert an amount between currencies using an exchange rate, rounded. */
export function convertMoney(amount: number, rate: number): number {
  return roundMoney(amount * rate);
}

/** Two monetary amounts are equal at cent precision. */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) < 0.005;
}

/** a is zero (or effectively zero) at cent precision. */
export function isZeroMoney(a: number): boolean {
  return Math.abs(roundMoney(a)) < 0.005;
}

/**
 * Line subtotal = price * qty - discount, floored at 0, rounded.
 */
export function calculateLineSubtotal(
  price: number,
  quantity: number,
  discount = 0,
): number {
  return roundMoney(Math.max(0, price * quantity - discount));
}

/**
 * Tax for a taxable base given a percentage rate (e.g. 16 for 16% IVA).
 * Returns 0 for a null/undefined/<=0 rate.
 */
export function calculateTax(base: number, ratePercent?: number | null): number {
  if (!ratePercent || ratePercent <= 0) return 0;
  return roundMoney(base * (ratePercent / 100));
}

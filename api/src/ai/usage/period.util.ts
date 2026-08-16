/** Periodo mensual en UTC, formato 'YYYY-MM' — clave de `ai_usage_counters`. */
export function currentPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

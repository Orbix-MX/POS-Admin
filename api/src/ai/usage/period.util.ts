/** Periodo mensual en UTC, formato 'YYYY-MM' — clave de `ai_usage_counters`. */
export function currentPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Día en UTC, formato 'YYYY-MM-DD' — ventana del kill switch de gasto diario (Fase 4). */
export function currentDay(now: Date = new Date()): string {
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${currentPeriod(now)}-${day}`;
}

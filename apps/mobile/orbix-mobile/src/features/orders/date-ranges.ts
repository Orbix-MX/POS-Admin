/**
 * Rangos de fecha para filtrar ventas.
 *
 * El servidor compara `createdAt` en UTC, así que el rango tiene que salir de
 * **aquí**, donde sí se sabe en qué huso vive el negocio: un "hoy" calculado en
 * el servidor haría que las ventas de la tarde de una tienda en UTC−6 cayeran
 * en el día siguiente. `new Date(y, m, d)` usa la hora local del dispositivo, y
 * `toISOString()` la convierte al instante absoluto que espera la API.
 *
 * El rango es `[desde, hasta)` — desde inclusivo, hasta exclusivo — para que
 * dos periodos consecutivos no cuenten dos veces la venta del límite.
 */

export type DateRangeKey = 'today' | 'week' | 'month';

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

/** Medianoche local del día de `date`. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Inicio de la semana, **lunes**.
 *
 * `getDay()` devuelve 0 para domingo; el comercio de habla hispana cuenta la
 * semana de lunes a domingo, así que el domingo pertenece a la semana que
 * termina, no a la que empieza.
 */
function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(startOfDay(date), -daysSinceMonday);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * @param key  periodo pedido
 * @param now  instante de referencia; parametrizado para poder probarlo
 */
export function resolveDateRange(key: DateRangeKey, now: Date = new Date()): DateRange {
  const from =
    key === 'today' ? startOfDay(now) : key === 'week' ? startOfWeek(now) : startOfMonth(now);

  // El "hasta" es siempre el arranque del día siguiente al de hoy: un periodo
  // en curso llega hasta el final del día de hoy, no hasta este instante — si
  // no, una venta hecha un segundo después de consultar quedaría fuera de un
  // rango que el usuario percibe como "hoy".
  const to = addDays(startOfDay(now), 1);

  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

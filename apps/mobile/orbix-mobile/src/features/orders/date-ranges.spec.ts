/**
 * Rangos de fecha para filtrar ventas.
 *
 * El error que estas pruebas vigilan es el de zona horaria: si el rango se
 * calculara con la fecha UTC en vez de la local, las ventas de la tarde de una
 * tienda en UTC−6 caerían en el día siguiente y el "hoy" del dueño mostraría
 * menos de lo que vendió.
 *
 * Las comparaciones son entre `Date` y `Date`, es decir entre instantes
 * absolutos, así que estas pruebas pasan en **cualquier** huso: no hace falta
 * fijar `TZ` en la configuración de Jest, y tampoco se está escondiendo el
 * desfase detrás de un entorno en UTC.
 */
import { resolveDateRange } from './date-ranges';

describe('resolveDateRange', () => {
  // Viernes 11 de septiembre de 2026, media tarde.
  const now = new Date(2026, 8, 11, 15, 30, 0);

  it('hoy va de la medianoche local al arranque de mañana', () => {
    const { dateFrom, dateTo } = resolveDateRange('today', now);

    expect(new Date(dateFrom)).toEqual(new Date(2026, 8, 11, 0, 0, 0));
    expect(new Date(dateTo)).toEqual(new Date(2026, 8, 12, 0, 0, 0));
  });

  it('la semana empieza en lunes', () => {
    const { dateFrom } = resolveDateRange('week', now);
    // El viernes 11 pertenece a la semana del lunes 7.
    expect(new Date(dateFrom)).toEqual(new Date(2026, 8, 7, 0, 0, 0));
  });

  it('el domingo cierra la semana, no la abre', () => {
    // Domingo 13 de septiembre: sigue siendo la semana del lunes 7.
    const sunday = new Date(2026, 8, 13, 11, 0, 0);
    const { dateFrom } = resolveDateRange('week', sunday);
    expect(new Date(dateFrom)).toEqual(new Date(2026, 8, 7, 0, 0, 0));
  });

  it('el lunes abre su propia semana', () => {
    const monday = new Date(2026, 8, 7, 9, 0, 0);
    const { dateFrom } = resolveDateRange('week', monday);
    expect(new Date(dateFrom)).toEqual(new Date(2026, 8, 7, 0, 0, 0));
  });

  it('el mes empieza el día 1', () => {
    const { dateFrom } = resolveDateRange('month', now);
    expect(new Date(dateFrom)).toEqual(new Date(2026, 8, 1, 0, 0, 0));
  });

  it('el hasta llega al final del día de hoy, no a este instante', () => {
    // Una venta hecha un segundo después de consultar tiene que seguir dentro
    // de lo que el usuario entiende por "hoy".
    for (const key of ['today', 'week', 'month'] as const) {
      const { dateTo } = resolveDateRange(key, now);
      expect(new Date(dateTo).getTime()).toBeGreaterThan(now.getTime());
      expect(new Date(dateTo)).toEqual(new Date(2026, 8, 12, 0, 0, 0));
    }
  });

  it('los tres periodos terminan en el mismo instante', () => {
    const [today, week, month] = (['today', 'week', 'month'] as const).map(
      (key) => resolveDateRange(key, now).dateTo,
    );
    expect(week).toBe(today);
    expect(month).toBe(today);
  });

  it('el desde se ensancha al ampliar el periodo', () => {
    const today = new Date(resolveDateRange('today', now).dateFrom).getTime();
    const week = new Date(resolveDateRange('week', now).dateFrom).getTime();
    const month = new Date(resolveDateRange('month', now).dateFrom).getTime();

    expect(week).toBeLessThan(today);
    expect(month).toBeLessThan(week);
  });

  it('cruza el cambio de mes sin romperse', () => {
    // Miércoles 2 de septiembre: su semana empieza en agosto.
    const earlyMonth = new Date(2026, 8, 2, 10, 0, 0);
    expect(new Date(resolveDateRange('week', earlyMonth).dateFrom)).toEqual(
      new Date(2026, 7, 31, 0, 0, 0),
    );
    expect(new Date(resolveDateRange('month', earlyMonth).dateFrom)).toEqual(
      new Date(2026, 8, 1, 0, 0, 0),
    );
  });

  it('devuelve ISO 8601 con zona, que es lo que espera la API', () => {
    const { dateFrom, dateTo } = resolveDateRange('today', now);
    expect(dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(dateTo).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

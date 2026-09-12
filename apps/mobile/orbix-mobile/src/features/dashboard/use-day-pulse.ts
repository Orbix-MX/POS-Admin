/**
 * Las cifras del día en Inicio: lo que el dueño abre la app para ver.
 *
 * ## De dónde salen los números, y por qué
 *
 * La auditoría daba por hecho que esto se construiría sobre `/reports`. No se
 * puede: `ReportsController` lleva `@RequireModule('reportes')` y ese módulo es
 * de tier **PRO**, mientras que el wizard de la app crea todo tenant en plan
 * **FREE fijo**. Es decir, el usuario que la app da de alta recibe 403 en cada
 * endpoint de reportes.
 *
 * Así que las fuentes van en este orden:
 *
 *   1. **El turno abierto.** `GET /cash-sessions/active` ya trae un `summary`
 *      calculado en el servidor —ventas por método, gastos, retiros, efectivo
 *      esperado—. Es gratis, es exacto, ya viaja para otra pantalla, y responde
 *      justo la pregunta de "hoy" en un negocio que abre y cierra caja.
 *   2. **El conteo del periodo.** `GET /orders` con el rango y `limit: 1`: no
 *      trae ventas, solo `meta.total`. Una petición mínima que sí funciona en
 *      cualquier plan.
 *   3. **Los reportes.** Solo si el plan los incluye. Añaden el importe por
 *      periodo y el comparativo. Un 403 aquí **no es un error**: es una función
 *      que ese plan no trae, y se muestra como tal.
 *
 * Lo que deliberadamente **no** se hace es sumar las ventas del mes en el
 * cliente: `GET /orders` embebe hoy cada producto completo dentro de sus
 * líneas, y pedir cientos de órdenes para sumar un total sería un payload
 * enorme para un número que el servidor puede dar en una sola consulta.
 * Mientras `/reports` siga siendo de pago, el importe por periodo se queda en
 * los planes que lo incluyen — y eso es una decisión de producto, no un límite
 * técnico (ver `plan-ciclo-de-dia.md` §7, cambio B5).
 */
import { useQuery } from '@tanstack/react-query';

import { useActiveCashSession } from '@/features/cash/use-cash-session';
import { resolveDateRange, type DateRangeKey } from '@/features/orders/date-ranges';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ordersRepository } from '@/repositories/orders-repository';
import { queryKeys } from '@/services/query/query-keys';

export interface DayPulse {
  /** Vendido en el turno abierto. `null` si no hay caja abierta. */
  shiftSales: number | null;
  /** Efectivo que debería haber en el cajón ahora. `null` sin caja abierta. */
  expectedCash: number | null;
  /** Gastos registrados en el turno. `null` sin caja abierta. */
  shiftExpenses: number | null;
  /** Ventas del periodo elegido. Siempre disponible. */
  ticketCount: number;
  /** Hay una caja abierta ahora mismo. */
  shiftOpen: boolean;
}

export function useDayPulse(range: DateRangeKey = 'today') {
  const { session } = useAuth();
  const { can } = usePermissions();
  const tenantId = session?.tenant?.id;
  const branchId = session?.branchId;

  const { data: cashSession, isLoading: loadingSession } = useActiveCashSession();

  const params = resolveDateRange(range);

  /**
   * Solo el conteo: `limit: 1` trae una orden y el `meta.total` del periodo.
   * Pedir más sería traer productos completos para sumar un número.
   */
  const { data: countPage, isLoading: loadingCount } = useQuery({
    queryKey: queryKeys.orders.list(tenantId, branchId, { ...params, count: true }),
    queryFn: () =>
      ordersRepository.list({
        ...params,
        ...(branchId ? { branchId } : {}),
        page: 1,
        limit: 1,
      }),
    enabled: Boolean(tenantId) && can('orders:view'),
    staleTime: 60 * 1000,
  });

  const summary = cashSession?.summary ?? null;

  const pulse: DayPulse = {
    shiftSales: summary?.totals.sales.total ?? null,
    expectedCash: summary?.expectedCash ?? null,
    shiftExpenses: summary?.totals.expense.total ?? null,
    ticketCount: countPage?.meta.total ?? 0,
    shiftOpen: Boolean(cashSession),
  };

  return {
    pulse,
    isLoading: loadingSession || loadingCount,
    /** El plan del tenant incluye el módulo de reportes. */
    hasReports: (session?.capabilities?.enabledModules ?? []).includes('reportes'),
  };
}

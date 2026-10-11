/**
 * Los primeros pasos de un negocio nuevo, **derivados del estado real**.
 *
 * No hay banderas de "ya hizo el paso 2" en MMKV, a propósito: guardar el
 * progreso mentiría en cuanto el usuario borre su único producto o cierre la
 * caja. Cada paso se responde con un dato que la app ya trae, así que el
 * checklist siempre dice la verdad — incluso hacia atrás.
 *
 * Un paso que el usuario **no puede** completar por falta de permiso no cuenta
 * como pendiente: se oculta. Si no, el vendedor sin `products:create` vería para
 * siempre un checklist que no puede terminar.
 */
import { useMemo } from 'react';

import { useActiveCashSession } from '@/features/cash/use-cash-session';
import { useDashboardStats } from '@/features/common/use-dashboard-stats';
import { usePermissions } from '@/hooks/use-permissions';

export type ChecklistStepId = 'product' | 'cash' | 'sale' | 'customer';

export interface ChecklistStep {
  id: ChecklistStepId;
  done: boolean;
  /** Ruta a la que lleva el paso cuando está pendiente. */
  route: '/(app)/products/new' | '/(app)/caja' | '/(app)/pos' | '/(app)/customers/new';
}

export interface OnboardingChecklist {
  steps: ChecklistStep[];
  /** Cuántos de los pasos visibles están hechos. */
  completed: number;
  /**
   * `true` cuando no queda nada por hacer — o cuando no hay ningún paso que
   * este usuario pueda hacer. En ambos casos el bloque no debe pintarse: un
   * checklist completo que sigue en pantalla es ruido permanente.
   */
  finished: boolean;
  isLoading: boolean;
}

export function useOnboardingChecklist(): OnboardingChecklist {
  const { can } = usePermissions();
  const { data: stats, isLoading: loadingStats } = useDashboardStats();
  const { data: cashSession, isLoading: loadingCash } = useActiveCashSession();

  const steps = useMemo<ChecklistStep[]>(() => {
    const all: (ChecklistStep & { allowed: boolean })[] = [
      {
        id: 'product',
        done: (stats?.totalProducts ?? 0) > 0,
        route: '/(app)/products/new',
        allowed: can('products:create'),
      },
      {
        id: 'cash',
        // Cualquier sesión viva cuenta, no solo ABIERTA: una caja en arqueo
        // también significa que el paso «abre tu caja» ya ocurrió.
        done: Boolean(cashSession),
        route: '/(app)/caja',
        allowed: can('pos.cash:open'),
      },
      {
        id: 'sale',
        done: (stats?.totalOrders ?? 0) > 0,
        route: '/(app)/pos',
        allowed: can('orders:create'),
      },
      {
        id: 'customer',
        done: (stats?.totalCustomers ?? 0) > 0,
        route: '/(app)/customers/new',
        allowed: can('customers:create'),
      },
    ];

    return all.filter((step) => step.allowed).map(({ allowed: _allowed, ...step }) => step);
  }, [stats, cashSession, can]);

  const completed = steps.filter((step) => step.done).length;

  return {
    steps,
    completed,
    finished: steps.length === 0 || completed === steps.length,
    // Mientras carga no se sabe nada: pintar «0 de 4» y luego saltar a «3 de 4»
    // se lee como si el progreso se hubiera perdido.
    isLoading: loadingStats || loadingCash,
  };
}

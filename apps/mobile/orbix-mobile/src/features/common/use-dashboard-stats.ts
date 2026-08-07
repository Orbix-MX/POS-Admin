import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { dashboardRepository } from '@/repositories/dashboard-repository';

/**
 * Home KPIs from `GET /dashboard/stats`.
 *
 * Gated on both a selected tenant (the endpoint reads `tenantId` from the JWT)
 * and the `dashboard:view` permission, so a POS-only user does not trigger a
 * guaranteed 403 on every home visit.
 */
export function useDashboardStats() {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: ['dashboard', 'stats', session?.tenant?.id],
    queryFn: () => dashboardRepository.getStats(),
    enabled: Boolean(session?.tenant) && can('dashboard:view'),
    staleTime: 60 * 1000,
  });
}

/**
 * Historial de ventas y detalle del ticket.
 *
 * Paginado con `useInfiniteQuery` desde el primer día: una tienda genera
 * decenas de ventas diarias, y el techo fijo de 100 que arrastran productos y
 * clientes aquí sería invisible en desarrollo y devastador en producción.
 */
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { QueryOrdersParams } from '@/dto/orders.dto';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { ordersRepository } from '@/repositories/orders-repository';
import { queryKeys } from '@/services/query/query-keys';

/**
 * Página corta a propósito: `GET /orders` embebe hoy cada producto completo
 * dentro de sus líneas, así que veinte ventas ya son un payload considerable.
 */
export const ORDERS_PAGE_SIZE = 20;

export function useOrders(params: Omit<QueryOrdersParams, 'page' | 'limit'>) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const branchId = session?.branchId;

  return useInfiniteQuery({
    queryKey: queryKeys.orders.list(session?.tenant?.id, branchId, params),
    queryFn: ({ pageParam }) =>
      ordersRepository.list({
        ...params,
        ...(branchId ? { branchId } : {}),
        page: pageParam,
        limit: ORDERS_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
    enabled: Boolean(session?.tenant) && can('orders:view'),
    staleTime: 30 * 1000,
  });
}

export function useOrder(id: string | undefined) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.orders.detail(session?.tenant?.id, session?.branchId, id),
    queryFn: () => ordersRepository.getById(id as string),
    enabled: Boolean(session?.tenant) && Boolean(id) && can('orders:view'),
  });
}

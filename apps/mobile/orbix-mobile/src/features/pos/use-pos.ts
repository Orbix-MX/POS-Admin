/**
 * Hooks del POS: sucursales, sesión de caja y creación de la venta.
 *
 * Caja y ventas viven ahora en `features/cash` y `features/orders`; aquí quedan
 * los que consume la pantalla de cobro, reexportados desde su origen para no
 * romper los call sites.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CreateOrderRequest } from '@/dto/orders.dto';
import { useAuth } from '@/hooks/use-auth';
import { branchesRepository } from '@/repositories/pos-repository';
import { ordersRepository, type Order } from '@/repositories/orders-repository';
import { queryKeys } from '@/services/query/query-keys';
import { toUserMessage } from '@/utils/error-message';

export { useActiveCashSession, useOpenCashSession } from '@/features/cash/use-cash-session';

export function useBranches() {
  const { session } = useAuth();

  return useQuery({
    queryKey: queryKeys.branches.list(session?.tenant?.id),
    queryFn: () => branchesRepository.list(),
    enabled: Boolean(session?.tenant),
    staleTime: 5 * 60 * 1000,
  });
}

/** Emails the ticket for a just-closed sale. Read-only on the order, hence `orders:view`. */
export function useSendReceipt() {
  const { t } = useTranslation();

  return useMutation<void, unknown, { orderId: string; email: string }>({
    mutationFn: ({ orderId, email }) => ordersRepository.sendReceipt(orderId, email),
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useCreateSaleOrder() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const tenantId = session?.tenant?.id;
  const branchId = session?.branchId;

  return useMutation<Order, unknown, CreateOrderRequest>({
    mutationFn: (request) => ordersRepository.create(request),
    onSuccess: () => {
      // Una venta consume existencia y mueve la caja: las tres vistas quedan
      // obsoletas a la vez. La de caja faltaba, así que el efectivo esperado se
      // quedaba en el valor de antes del cobro.
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists(tenantId, branchId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.details(tenantId, branchId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists(tenantId, branchId) });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

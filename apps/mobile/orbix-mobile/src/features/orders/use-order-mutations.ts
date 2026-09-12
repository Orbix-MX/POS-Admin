/**
 * Deshacer una venta: cancelar, devolver entera, o devolver parte.
 *
 * Las tres mueven dinero e inventario en el servidor, así que las tres
 * invalidan **también** el subárbol de caja: el efectivo esperado cambia en el
 * mismo momento, y dejarlo viejo haría que el corte no cuadrara con lo que el
 * operador acaba de hacer.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CancelOrderRequest, RefundOrderRequest } from '@/dto/orders.dto';
import { useAuth } from '@/hooks/use-auth';
import { ordersRepository, type Order } from '@/repositories/orders-repository';
import { queryKeys } from '@/services/query/query-keys';
import { toUserMessage } from '@/utils/error-message';

/** Lo que hay que refrescar tras deshacer una venta. */
function useReverseInvalidation(orderId: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = session?.tenant?.id;
  const branchId = session?.branchId;

  return () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.orders.detail(tenantId, branchId, orderId),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists(tenantId, branchId) });
    // El servidor revierte el movimiento de caja en la misma transacción.
    void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    // Y devuelve la existencia al inventario.
    void queryClient.invalidateQueries({ queryKey: queryKeys.products.lists(tenantId, branchId) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  };
}

/** Anula la venta entera. Requiere `orders:edit` y un motivo. */
export function useCancelOrder(orderId: string) {
  const { t } = useTranslation();
  const invalidate = useReverseInvalidation(orderId);

  return useMutation<Order, unknown, CancelOrderRequest>({
    mutationFn: (request) => ordersRepository.cancel(orderId, request),
    onSuccess: invalidate,
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/** Devolución completa: revierte inventario y efectivo. Requiere `orders:edit`. */
export function useReturnOrder(orderId: string) {
  const { t } = useTranslation();
  const invalidate = useReverseInvalidation(orderId);

  return useMutation<Order, unknown, CancelOrderRequest>({
    mutationFn: (request) => ordersRepository.returnSale(orderId, request),
    onSuccess: invalidate,
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/**
 * Devolución parcial por líneas. Requiere `refunds:create`.
 *
 * Con `items` el servidor restaura el inventario exactamente de esas líneas y
 * acota la cantidad por (vendido − ya devuelto): la UI calcula el mismo resto
 * para no ofrecer cantidades que la API va a rechazar.
 */
export function useRefundOrder(orderId: string) {
  const { t } = useTranslation();
  const invalidate = useReverseInvalidation(orderId);

  return useMutation<unknown, unknown, RefundOrderRequest>({
    mutationFn: (request) => ordersRepository.refund(orderId, request),
    onSuccess: invalidate,
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

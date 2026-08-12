import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CreateOrderRequest, OpenCashSessionRequest } from '@/dto/pos.dto';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  branchesRepository,
  cashSessionsRepository,
  ordersRepository,
  type CashSession,
  type Order,
} from '@/repositories/pos-repository';
import { toUserMessage } from '@/utils/error-message';

export function useBranches() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['branches', 'list', session?.tenant?.id],
    queryFn: () => branchesRepository.list(),
    enabled: Boolean(session?.tenant),
    staleTime: 5 * 60 * 1000,
  });
}

export function useActiveCashSession() {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: ['cash-sessions', 'active', session?.tenant?.id, session?.branchId],
    queryFn: () => cashSessionsRepository.getActive(),
    enabled: Boolean(session?.tenant) && Boolean(session?.branchId) && can('cash:view'),
    staleTime: 15 * 1000,
  });
}

export function useOpenCashSession() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashSession, unknown, OpenCashSessionRequest>({
    mutationFn: (request) => cashSessionsRepository.open(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cash-sessions', 'active', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
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

  return useMutation<Order, unknown, CreateOrderRequest>({
    mutationFn: (request) => ordersRepository.create(request),
    onSuccess: () => {
      // A sale consumes stock — the products list/detail queries are now stale.
      void queryClient.invalidateQueries({ queryKey: ['products', 'list', session?.tenant?.id] });
      void queryClient.invalidateQueries({ queryKey: ['products', 'detail', session?.tenant?.id] });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

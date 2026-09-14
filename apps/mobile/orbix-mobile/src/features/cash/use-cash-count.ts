/**
 * Arqueo y corte: las operaciones que cuentan el cajón y cierran el turno.
 *
 * Las cuatro pueden exigir el PIN de un supervisor —el servidor lo resuelve por
 * dentro—, así que se consumen siempre a través de `usePinAuthorization`.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CloseCashSessionRequest, CreateCashCountRequest } from '@/dto/cash.dto';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  cashSessionsRepository,
  type CashCount,
  type CashSession,
} from '@/repositories/cash-repository';
import { queryKeys } from '@/services/query/query-keys';
import { toUserMessage } from '@/utils/error-message';

/** `ABIERTA → EN_ARQUEO`. Congela la caja para poder contarla sin que se mueva. */
export function useStartCashCount(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashSession, unknown, { authorizerPin?: string }>({
    mutationFn: (request) => cashSessionsRepository.startCount(sessionId as string, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/** `EN_ARQUEO → ABIERTA`. Devuelve la caja a operación tras un arqueo de control. */
export function useResumeCashSession(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashSession, unknown, { authorizerPin?: string }>({
    mutationFn: (request) => cashSessionsRepository.resume(sessionId as string, request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/** Registra el conteo físico sobre la sesión abierta. */
export function useCreateCashCount() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashCount, unknown, CreateCashCountRequest>({
    mutationFn: (request) => cashSessionsRepository.createCount(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/**
 * El corte.
 *
 * Un 200 **no** significa que el turno quedó cerrado: si la diferencia supera
 * `Tenant.settings.cashDifferenceThreshold`, el servidor devuelve la sesión en
 * `PENDIENTE_REVISION` y la caja sigue congelada esperando a alguien con
 * `pos.cash:authorize`. Quien llame tiene que mirar el `status` devuelto.
 */
export function useCloseCashSession(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashSession, unknown, CloseCashSessionRequest>({
    mutationFn: (request) => cashSessionsRepository.close(sessionId as string, request),
    onSuccess: () => {
      // Todo: la sesión activa desaparece, el historial gana una fila y la
      // capacidad del plan libera un hueco.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/** Los arqueos ya registrados en una sesión. */
export function useCashCounts(sessionId: string | undefined) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.cash.counts(session?.tenant?.id, session?.branchId, sessionId),
    queryFn: () => cashSessionsRepository.listCounts(sessionId as string),
    enabled: Boolean(session?.tenant) && Boolean(sessionId) && can('cash:view'),
  });
}

/** Quién estuvo en la caja durante la sesión, en orden de entrada. */
export function useCashHandovers(sessionId: string | undefined) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.cash.handovers(session?.tenant?.id, session?.branchId, sessionId),
    queryFn: () => cashSessionsRepository.listHandovers(sessionId as string),
    enabled: Boolean(session?.tenant) && Boolean(sessionId) && can('cash:view'),
    staleTime: 30 * 1000,
  });
}

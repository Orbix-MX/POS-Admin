/**
 * Los movimientos que un turno genera a mano: gastos, ingresos y retiros.
 *
 * Los tres invalidan todo el subárbol de caja — cambian el efectivo esperado,
 * que es lo que lee cada pantalla del ciclo del día.
 *
 * Permisos: gasto e ingreso son `cash:manage`; retirar es `pos.cash:withdraw`,
 * deliberadamente más restrictivo — sacar dinero del cajón pesa más que
 * anotar un gasto.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { CreateManualMovementRequest, WithdrawCashRequest } from '@/dto/cash.dto';
import { cashMovementsRepository, type CashMovement } from '@/repositories/cash-repository';
import { queryKeys } from '@/services/query/query-keys';
import { toUserMessage } from '@/utils/error-message';

export function useCreateCashMovement() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashMovement, unknown, CreateManualMovementRequest>({
    mutationFn: (request) => cashMovementsRepository.createManual(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useWithdrawCash() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashMovement, unknown, WithdrawCashRequest>({
    mutationFn: (request) => cashMovementsRepository.withdraw(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

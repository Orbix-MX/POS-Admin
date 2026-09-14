/**
 * La sesión de caja del turno: leerla, abrirla, y saber en qué caja física
 * estamos.
 *
 * `cashRegisterId` sale de MMKV y no del servidor: la caja pertenece al puesto,
 * así que es el dispositivo el que recuerda cuál opera. Sin él, el backend
 * devuelve la única sesión viva de la sucursal —o la que abrió el propio
 * usuario si hay varias—, que es el comportamiento correcto para una
 * instalación de caja única.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StorageKeys } from '@/constants/storage-keys';
import type { CreateCashRegisterRequest, OpenCashSessionRequest } from '@/dto/cash.dto';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import {
  cashRegistersRepository,
  cashSessionsRepository,
  type CashRegister,
  type CashSession,
} from '@/repositories/cash-repository';
import { queryKeys } from '@/services/query/query-keys';
import { kvStorage } from '@/services/storage/kv-storage';
import { toUserMessage } from '@/utils/error-message';

/** La caja física que opera este dispositivo, o `undefined` para "la que haya". */
export function getActiveCashRegisterId(): string | undefined {
  return kvStorage.getString(StorageKeys.cashRegisterId);
}

export function useActiveCashRegisterId() {
  const [value, setValue] = useState<string | undefined>(getActiveCashRegisterId);

  const select = useCallback((registerId: string | undefined) => {
    if (registerId) kvStorage.setString(StorageKeys.cashRegisterId, registerId);
    else kvStorage.remove(StorageKeys.cashRegisterId);
    setValue(registerId);
  }, []);

  return { cashRegisterId: value, selectCashRegister: select };
}

export function useActiveCashSession() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const { cashRegisterId } = useActiveCashRegisterId();

  return useQuery({
    queryKey: queryKeys.cash.active(session?.tenant?.id, session?.branchId, cashRegisterId),
    queryFn: () => cashSessionsRepository.getActive({ cashRegisterId }),
    enabled: Boolean(session?.tenant) && Boolean(session?.branchId) && can('cash:view'),
    staleTime: 15 * 1000,
  });
}

export function useCashSession(id: string | undefined) {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.cash.session(session?.tenant?.id, session?.branchId, id),
    queryFn: () => cashSessionsRepository.getById(id as string),
    enabled: Boolean(session?.tenant) && Boolean(id) && can('cash:view'),
  });
}

export function useCashRegisters() {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.cash.registers(session?.tenant?.id, session?.branchId),
    queryFn: () => cashRegistersRepository.list(),
    enabled: Boolean(session?.tenant) && Boolean(session?.branchId) && can('cash:view'),
    staleTime: 60 * 1000,
  });
}

export function useCashSessionCapacity() {
  const { session } = useAuth();
  const { can } = usePermissions();

  return useQuery({
    queryKey: queryKeys.cash.capacity(session?.tenant?.id, session?.branchId),
    queryFn: () => cashRegistersRepository.capacity(),
    enabled: Boolean(session?.tenant) && Boolean(session?.branchId) && can('cash:view'),
    staleTime: 60 * 1000,
  });
}

/**
 * Deja constancia de que este usuario tomó la caja abierta.
 *
 * Se dispara al ver una sesión viva, no al abrirla: el caso que registra es el
 * **relevo de turno**, donde la caja ya estaba abierta por otra persona. El
 * servidor es idempotente, así que reabrir la app no duplica el tramo.
 *
 * Falla en silencio a propósito: no poder anotar la bitácora no debe impedir
 * cobrar. El corte lo notará como un tramo que falta, no como una venta perdida.
 */
export function useHandoverTracking(session: CashSession | null | undefined) {
  const queryClient = useQueryClient();
  const { session: authSession } = useAuth();
  const sessionId = session?.id;
  const userId = authSession?.user.id;

  // Una vez por (sesión, usuario) y arranque de app: el servidor ya deduplica,
  // pero no hace falta mandarle una petición por cada render.
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || !userId) return;
    const key = `${sessionId}:${userId}`;
    if (registered.current === key) return;
    registered.current = key;

    void cashSessionsRepository
      .registerHandover(sessionId)
      .then(() => {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cash.handovers(authSession?.tenant?.id, authSession?.branchId, sessionId),
        });
      })
      .catch(() => {
        // Sin red, o sin permiso: se reintenta al siguiente arranque.
        registered.current = null;
      });
  }, [sessionId, userId, queryClient, authSession?.tenant?.id, authSession?.branchId]);
}

/**
 * Alta de caja física. Sin esto, «todas las cajas están abiertas» —lo que
 * responde el servidor cuando no queda ninguna libre— es un callejón sin salida
 * desde la app.
 */
export function useCreateCashRegister() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashRegister, unknown, CreateCashRegisterRequest>({
    mutationFn: (request) => cashRegistersRepository.create(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation<CashSession, unknown, OpenCashSessionRequest>({
    mutationFn: (request) => cashSessionsRepository.open(request),
    onSuccess: () => {
      // Todo el subárbol de caja: la sesión activa, el listado de cajas (una
      // acaba de ocuparse) y la capacidad del plan.
      void queryClient.invalidateQueries({ queryKey: queryKeys.cash.all });
    },
    meta: { errorMessage: (error: unknown) => toUserMessage(error, t) },
  });
}

/**
 * El patrón de autorización respaldada por PIN, en un solo sitio.
 *
 * Cuatro operaciones de caja —congelar, reanudar, arquear y cortar— no llevan
 * `@RequirePermissions` en el servidor: lo resuelven por dentro con el permiso
 * propio del usuario **o** con el PIN de un empleado que sí lo tenga. El
 * supervisor se acerca a la terminal y teclea su PIN, sin que el cajero conozca
 * ninguna contraseña ni tenga que cerrar sesión.
 *
 * De ahí la forma del flujo:
 *
 *   1. intentar **sin** PIN;
 *   2. si el servidor responde `AUTHORIZATION_REQUIRED`, guardar lo que se
 *      quería hacer y pedir el PIN;
 *   3. reintentar lo mismo con `authorizerPin`.
 *
 * Nunca al revés. Pedir el PIN por adelantado se lo pediría también a quien sí
 * tiene el permiso, y ocultar el botón por `can()` rompería justo el caso para
 * el que existe el PIN (ver D3 del plan).
 *
 * Este archivo es solo la cáscara de React. La regla de qué pasa tras cada
 * respuesta vive en `pin-auth-machine.ts`, que es puro y está probado aparte.
 */
import { useCallback, useReducer } from 'react';

import {
  initialPinAuthState,
  pinAuthReducer,
  type PinAuthEvent,
  type PinAuthState,
} from './pin-auth-machine';

/** Lo que se envía: el payload propio de la operación más el PIN opcional. */
export type WithPin<TInput> = TInput & { authorizerPin?: string };

export interface PinAuthorization<TInput> {
  /** `true` mientras la hoja del PIN está abierta esperando al supervisor. */
  pinRequired: boolean;
  /** `true` cuando el último PIN tecleado no sirvió. */
  pinInvalid: boolean;
  /** Lanza la operación sin PIN. Si el servidor lo pide, abre la hoja. */
  run: (input: TInput) => void;
  /** Reintenta lo mismo con el PIN que tecleó el supervisor. */
  submitPin: (pin: string) => void;
  /** Cierra la hoja y olvida la operación pendiente. */
  cancel: () => void;
}

/**
 * @param mutate  la mutación que acepta `authorizerPin` — típicamente el
 *                `mutate` de un `useMutation` de TanStack.
 */
export function usePinAuthorization<TInput>(
  mutate: (
    input: WithPin<TInput>,
    handlers: { onSuccess?: () => void; onError?: (error: unknown) => void },
  ) => void,
  onSuccess?: () => void,
): PinAuthorization<TInput> {
  const [state, dispatch] = useReducer(
    pinAuthReducer as (s: PinAuthState<TInput>, e: PinAuthEvent<TInput>) => PinAuthState<TInput>,
    undefined,
    initialPinAuthState<TInput>,
  );

  const fire = useCallback(
    (input: TInput, pin?: string) => {
      dispatch({ type: 'attempt', input });
      mutate({ ...input, ...(pin ? { authorizerPin: pin } : {}) } as WithPin<TInput>, {
        onSuccess: () => {
          dispatch({ type: 'success' });
          onSuccess?.();
        },
        onError: (error: unknown) => dispatch({ type: 'failure', error }),
      });
    },
    [mutate, onSuccess],
  );

  const run = useCallback((input: TInput) => fire(input), [fire]);

  const submitPin = useCallback(
    (pin: string) => {
      if (!state.pending) return;
      fire(state.pending, pin);
    },
    [fire, state.pending],
  );

  const cancel = useCallback(() => dispatch({ type: 'success' }), []);

  return {
    pinRequired: state.pinRequired,
    pinInvalid: state.pinInvalid,
    run,
    submitPin,
    cancel,
  };
}

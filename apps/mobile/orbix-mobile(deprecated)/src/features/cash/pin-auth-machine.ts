/**
 * La regla de "qué pasa ahora" del flujo de autorización por PIN, como función
 * pura.
 *
 * Vive fuera del hook a propósito: decidir si hay que pedir el PIN, si hay que
 * volver a pedirlo o si hay que rendirse **no es lógica de React** — es la
 * regla del dominio, y es donde están los errores caros (perder lo que el
 * usuario quería hacer, dejar la hoja colgada tras un 500, pedirle el PIN a
 * quien no lo necesita). Separada así se prueba entera sin renderizar nada.
 *
 * El hook (`use-pin-authorization.ts`) es la cáscara que la conecta a
 * `useState` y a la mutación.
 */
import { isAuthorizationInvalid, isAuthorizationRequired } from '@/utils/error-message';

export interface PinAuthState<TInput> {
  /** Lo que se quería hacer, a la espera del PIN. `null` = nada pendiente. */
  pending: TInput | null;
  pinRequired: boolean;
  pinInvalid: boolean;
}

export type PinAuthEvent<TInput> =
  | { type: 'attempt'; input: TInput }
  | { type: 'success' }
  | { type: 'failure'; error: unknown };

export function initialPinAuthState<TInput>(): PinAuthState<TInput> {
  return { pending: null, pinRequired: false, pinInvalid: false };
}

/**
 * @param state  estado actual
 * @param event  lo que acaba de ocurrir
 * @returns      el estado siguiente
 */
export function pinAuthReducer<TInput>(
  state: PinAuthState<TInput>,
  event: PinAuthEvent<TInput>,
): PinAuthState<TInput> {
  switch (event.type) {
    case 'attempt':
      // Se recuerda qué se intentó: es lo que se reenviará con el PIN. Sin
      // esto, el reintento mandaría un payload vacío.
      return { ...state, pending: event.input };

    case 'success':
      return initialPinAuthState();

    case 'failure': {
      if (isAuthorizationRequired(event.error)) {
        // El usuario no tiene el permiso. Se pide el respaldo de un supervisor
        // y se conserva lo pendiente.
        return { pending: state.pending, pinRequired: true, pinInvalid: false };
      }
      if (isAuthorizationInvalid(event.error)) {
        // El PIN no sirve. La hoja sigue abierta para reintentar, y lo
        // pendiente se conserva: el supervisor puede teclear otro.
        return { pending: state.pending, pinRequired: true, pinInvalid: true };
      }
      // Cualquier otro error —un 500, la caja ya cerrada, la red— no se arregla
      // con otro PIN. Se cierra la hoja y lo pinta quien llama desde el estado
      // de la mutación.
      return initialPinAuthState();
    }
  }
}

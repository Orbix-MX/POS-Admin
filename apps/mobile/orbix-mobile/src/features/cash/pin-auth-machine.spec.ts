/**
 * La regla de autorización por PIN.
 *
 * Es la pieza con más formas de salir mal del ciclo del día: pedir el PIN a
 * quien no lo necesita, perder lo que el usuario quería hacer entre el primer
 * intento y el reintento, o dejar la hoja abierta tras un error que no tiene
 * nada que ver con la autorización.
 */
import { ApiError } from '@/services/api';

import {
  initialPinAuthState,
  pinAuthReducer,
  type PinAuthState,
} from './pin-auth-machine';

interface Payload {
  amount: number;
  reason?: string;
}

const authRequired = new ApiError(
  'forbidden',
  'Esta operación requiere la autorización de un supervisor.',
  403,
  [],
  'AUTHORIZATION_REQUIRED',
);

const authInvalid = new ApiError(
  'forbidden',
  'PIN incorrecto o sin permiso para autorizar esta operación.',
  403,
  [],
  'AUTHORIZATION_INVALID',
);

/** Aplica una secuencia de eventos desde el estado inicial. */
function run(...events: Parameters<typeof pinAuthReducer<Payload>>[1][]): PinAuthState<Payload> {
  return events.reduce(pinAuthReducer<Payload>, initialPinAuthState<Payload>());
}

describe('pinAuthReducer', () => {
  it('arranca sin nada pendiente y sin pedir PIN', () => {
    expect(initialPinAuthState<Payload>()).toEqual({
      pending: null,
      pinRequired: false,
      pinInvalid: false,
    });
  });

  it('recuerda lo que se intentó', () => {
    const state = run({ type: 'attempt', input: { amount: 250, reason: 'Caja fuerte' } });
    expect(state.pending).toEqual({ amount: 250, reason: 'Caja fuerte' });
    // Intentar no abre la hoja: puede que el usuario sí tenga el permiso.
    expect(state.pinRequired).toBe(false);
  });

  it('no pide PIN cuando la operación sale bien', () => {
    const state = run(
      { type: 'attempt', input: { amount: 100 } },
      { type: 'success' },
    );
    expect(state).toEqual(initialPinAuthState());
  });

  it('abre la hoja ante AUTHORIZATION_REQUIRED y conserva lo pendiente', () => {
    const state = run(
      { type: 'attempt', input: { amount: 250, reason: 'Caja fuerte' } },
      { type: 'failure', error: authRequired },
    );
    expect(state.pinRequired).toBe(true);
    expect(state.pinInvalid).toBe(false);
    // Lo pendiente es lo que se reenviará con el PIN: perderlo mandaría vacío.
    expect(state.pending).toEqual({ amount: 250, reason: 'Caja fuerte' });
  });

  it('marca inválido y deja reintentar cuando el PIN no sirve', () => {
    const state = run(
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error: authRequired },
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error: authInvalid },
    );
    expect(state.pinRequired).toBe(true);
    expect(state.pinInvalid).toBe(true);
    expect(state.pending).toEqual({ amount: 100 });
  });

  it('limpia el estado cuando el segundo PIN funciona', () => {
    const state = run(
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error: authRequired },
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error: authInvalid },
      { type: 'attempt', input: { amount: 100 } },
      { type: 'success' },
    );
    expect(state).toEqual(initialPinAuthState());
  });

  it.each([
    ['un 500', new ApiError('server', 'Boom', 500)],
    ['la red caída', new ApiError('network', 'Sin conexión')],
    ['un 403 sin código de dominio', new ApiError('forbidden', 'Forbidden resource', 403)],
    ['la caja ya cerrada', new ApiError('validation', 'Sesión de caja no encontrada', 400)],
    ['algo que no es ApiError', new Error('raro')],
  ])('cierra la hoja ante %s — otro PIN no lo arregla', (_name, error) => {
    const state = run(
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error: authRequired },
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error },
    );
    expect(state).toEqual(initialPinAuthState());
  });

  it('un 403 genérico NO se confunde con pedir PIN', () => {
    // `kind` es el mismo que el de AUTHORIZATION_REQUIRED; lo que los separa es
    // el `code`. Sin él, cualquier falta de permiso abriría la hoja del PIN.
    const state = run(
      { type: 'attempt', input: { amount: 100 } },
      { type: 'failure', error: new ApiError('forbidden', 'No tienes permiso', 403) },
    );
    expect(state.pinRequired).toBe(false);
  });
});

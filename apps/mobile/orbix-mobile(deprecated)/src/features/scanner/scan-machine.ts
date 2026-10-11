/**
 * La regla de "qué hace la cámara ahora", como función pura.
 *
 * El problema que resuelve no es de interfaz: `CameraView` emite un evento **por
 * fotograma** mientras el código siga a la vista. Sin una puerta, apuntar dos
 * segundos a una etiqueta manda treinta peticiones y mete treinta unidades al
 * carrito. Por eso el sensor se cierra en cuanto lee y no se vuelve a abrir
 * hasta que alguien lo decide.
 *
 * Vive fuera del componente porque es donde están los errores caros —el bucle,
 * el escaneo que se pierde mientras resuelve el anterior, el código repetido
 * que el operador sí quería contar dos veces— y así se prueba sin cámara.
 *
 * El hook (`use-scanner.ts`) la conecta a `useReducer` y a la petición.
 */

export type ScanPhase =
  /** Sensor abierto, esperando una etiqueta. */
  | 'scanning'
  /** Leído: el sensor está cerrado y la consulta en vuelo. */
  | 'resolving'
  /** Resuelto y añadido. Se muestra qué entró y se vuelve a abrir. */
  | 'hit'
  /** El código no existe en el catálogo. Ofrece darlo de alta. */
  | 'miss'
  /** La consulta falló por otra razón (red, permiso, 500). */
  | 'error';

export interface ScanState<TResult> {
  phase: ScanPhase;
  /** El código leído, mientras se resuelve y después. `null` en reposo. */
  code: string | null;
  /** Lo encontrado, en `hit`. */
  result: TResult | null;
  /** El fallo, en `error`. */
  error: unknown;
  /**
   * Cuántas etiquetas se han leído sin salir de la hoja. Es lo que permite al
   * operador seguir escaneando sin mirar: si el contador sube, entró.
   */
  count: number;
}

export type ScanEvent<TResult> =
  | { type: 'read'; code: string }
  | { type: 'resolved'; result: TResult }
  | { type: 'notFound' }
  | { type: 'failed'; error: unknown }
  /** Volver a abrir el sensor: tras un acierto, o al descartar un fallo. */
  | { type: 'rearm' };

export function initialScanState<TResult>(): ScanState<TResult> {
  return { phase: 'scanning', code: null, result: null, error: null, count: 0 };
}

export function scanReducer<TResult>(
  state: ScanState<TResult>,
  event: ScanEvent<TResult>,
): ScanState<TResult> {
  switch (event.type) {
    case 'read': {
      // La puerta. Solo `scanning` admite una lectura: en cualquier otra fase
      // el evento es un fotograma más de la misma etiqueta, o una segunda
      // etiqueta que entró mientras la primera resolvía.
      //
      // Deliberadamente NO se ignora un código repetido: en un mostrador, dos
      // latas iguales se escanean dos veces y las dos se cobran. Lo que corta
      // el bucle es la fase, no el valor.
      if (state.phase !== 'scanning') return state;

      const code = event.code.trim();
      if (!code) return state;

      return { ...state, phase: 'resolving', code, result: null, error: null };
    }

    case 'resolved':
      // Llegó una respuesta sin lectura en vuelo: el usuario cerró o reinició
      // entre medias. Descartarla evita añadir algo que ya no se pidió.
      if (state.phase !== 'resolving') return state;
      return { ...state, phase: 'hit', result: event.result, count: state.count + 1 };

    case 'notFound':
      if (state.phase !== 'resolving') return state;
      return { ...state, phase: 'miss', result: null };

    case 'failed':
      if (state.phase !== 'resolving') return state;
      return { ...state, phase: 'error', error: event.error };

    case 'rearm':
      // El contador sobrevive: es el recuento de la sesión de escaneo, no de la
      // última lectura.
      return { ...state, phase: 'scanning', code: null, result: null, error: null };

    default:
      return state;
  }
}

/** `true` mientras el sensor deba estar cerrado. */
export function isSensorClosed(state: ScanState<unknown>): boolean {
  return state.phase !== 'scanning';
}

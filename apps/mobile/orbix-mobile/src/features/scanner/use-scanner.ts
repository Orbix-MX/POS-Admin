/**
 * La cáscara de React alrededor de `scan-machine`.
 *
 * Junta dos cosas que el componente no debería tener que coordinar: la puerta
 * que impide el bucle de fotogramas, y la consulta que traduce un código a un
 * artículo. El permiso de cámara es de `CameraStage`, que es quien la monta.
 *
 * El eco háptico va aquí y no en la hoja porque es parte de "acabo de leer",
 * no de cómo se pinta: en un mostrador con gente, el pitido del sensor no se
 * oye y la vibración es la única confirmación que llega.
 */
import * as Haptics from 'expo-haptics';
import { useCallback, useReducer, useRef } from 'react';

import { productsRepository, type ResolvedCode } from '@/repositories/products-repository';
import { ApiError } from '@/services/api';

import { initialScanState, isSensorClosed, scanReducer, type ScanState } from './scan-machine';

export interface Scanner {
  state: ScanState<ResolvedCode>;
  /** `true` mientras el sensor deba ignorar lo que ve. */
  paused: boolean;
  /** Lo que se conecta a `onBarcodeScanned`. */
  read: (code: string) => void;
  /** Reabrir el sensor tras un acierto o un descarte. */
  rearm: () => void;
  /** Volver a intentar el mismo código tras un fallo de red. */
  retry: () => void;
}

export function useScanner(): Scanner {
  const [state, dispatch] = useReducer(
    scanReducer<ResolvedCode>,
    undefined,
    initialScanState<ResolvedCode>,
  );

  /**
   * La misma puerta que el reducer, pero **síncrona**.
   *
   * El estado de React no se actualiza hasta el siguiente render, y la cámara
   * puede entregar varios fotogramas antes de que llegue: leyendo `state` se
   * colarían dos lecturas y saldrían dos peticiones. El reducer descartaría la
   * segunda respuesta —está probado—, pero la petición ya habría salido. El ref
   * cierra la puerta en el mismo instante en que se lee.
   */
  const busy = useRef(false);

  const resolve = useCallback((code: string) => {
    productsRepository
      .resolveCode(code)
      .then((result) => dispatch({ type: 'resolved', result }))
      .catch((error: unknown) => {
        // Un 404 no es una avería: es el código que no está en el catálogo, y
        // es lo que abre "créalo con este código ya puesto".
        if (error instanceof ApiError && error.status === 404) {
          dispatch({ type: 'notFound' });
          return;
        }
        dispatch({ type: 'failed', error });
      });
  }, []);

  const read = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (busy.current || !code) return;
      busy.current = true;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      dispatch({ type: 'read', code });
      resolve(code);
    },
    [resolve],
  );

  const rearm = useCallback(() => {
    busy.current = false;
    dispatch({ type: 'rearm' });
  }, []);

  const retry = useCallback(() => {
    const code = state.code;
    if (!code) return;
    // El reintento pasa por la misma puerta que una lectura de la cámara: se
    // rearma y se vuelve a leer el mismo código.
    busy.current = false;
    dispatch({ type: 'rearm' });
    read(code);
  }, [state.code, read]);

  return { state, paused: isSensorClosed(state), read, rearm, retry };
}

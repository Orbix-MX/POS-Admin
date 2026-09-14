/**
 * Leer un código para **copiarlo a un campo**, sin buscarlo en el catálogo.
 *
 * Es lo contrario del escáner del POS: aquí el código que aún no existe es
 * justamente el caso normal —se está dando de alta el producto que lo lleva—,
 * así que consultar al servidor no aportaría nada y un 404 sería ruido.
 *
 * Una sola lectura y se cierra: quien está rellenando un formulario no encadena
 * escaneos, y dejar la cámara abierta después de acertar solo invita a que la
 * siguiente etiqueta del mostrador pise lo que acaba de capturar.
 */
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { OrbixText } from '@/components/ui/orbix-text';

import { CameraStage, ScannerOverlay } from './camera-stage';

export interface CodeCaptureSheetProps {
  visible: boolean;
  onClose: () => void;
  /** El código leído. Quien lo recibe decide qué hacer y cerrar la hoja. */
  onCapture: (code: string) => void;
}

function CodeCaptureSheetComponent({ visible, onClose, onCapture }: CodeCaptureSheetProps) {
  const { t } = useTranslation();

  /**
   * `CameraView` emite un evento por fotograma mientras el código siga a la
   * vista. Sin este cerrojo —síncrono, porque el estado de React llega un
   * render tarde— `onCapture` correría decenas de veces por una sola etiqueta.
   */
  const captured = useRef(false);

  // Se reabre limpio: sin esto, la segunda vez que se abre la hoja el cerrojo
  // sigue echado y la cámara no lee nada.
  useEffect(() => {
    if (visible) captured.current = false;
  }, [visible]);

  const handleRead = useCallback(
    (code: string) => {
      const value = code.trim();
      if (captured.current || !value) return;
      captured.current = true;

      // En un mostrador ruidoso la vibración es la única confirmación que llega.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onCapture(value);
    },
    [onCapture],
  );

  return (
    <CameraStage
      visible={visible}
      onClose={onClose}
      onRead={handleRead}
      paused={captured.current}
      overlay={
        <ScannerOverlay>
          <OrbixText size="sm" align="center" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {t('scanner.capture')}
          </OrbixText>
        </ScannerOverlay>
      }
    />
  );
}

export const CodeCaptureSheet = memo(CodeCaptureSheetComponent);

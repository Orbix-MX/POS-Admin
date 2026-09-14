/**
 * El escáner de venta: leer una etiqueta y cobrarla.
 *
 * Tres desenlaces, no dos — es lo que separa un escáner usable de uno que
 * frustra:
 *
 * - **encontrado** → entra al carrito y el sensor se reabre solo, para
 *   encadenar lecturas sin tocar nada;
 * - **desconocido** → se ofrece darlo de alta con el código ya puesto, que es
 *   la única salida real cuando el catálogo aún no lo tiene;
 * - **fallo de red** → se explica y se puede reintentar el mismo código.
 *
 * El permiso de cámara y el visor viven en `CameraStage`, compartidos con el
 * escáner del alta de producto.
 */
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OrbixButton } from '@/components/buttons/orbix-button';
import { OrbixText } from '@/components/ui/orbix-text';
import type { ResolvedCode } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';

import { CameraStage, ScannerOverlay } from './camera-stage';
import { useScanner } from './use-scanner';

/**
 * Cuánto se queda en pantalla el resumen de lo que acaba de entrar antes de
 * reabrir el sensor. Sin esta pausa, la etiqueta que sigue delante del objetivo
 * se lee otra vez; con mucho más, escanear una fila de productos se hace lento.
 */
const REARM_DELAY_MS = 900;

export interface BarcodeScannerSheetProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Qué hacer con lo encontrado. Devuelve el texto a mostrar como confirmación
   * —"Refresco · 600 ml"—, que es lo único que el operador mira antes de
   * apuntar a la siguiente etiqueta.
   */
  onResolved: (hit: ResolvedCode) => string;
  /** Dar de alta el código que no existe. Se omite sin permiso de creación. */
  onCreateMissing?: (code: string) => void;
}

function BarcodeScannerSheetComponent({
  visible,
  onClose,
  onResolved,
  onCreateMissing,
}: BarcodeScannerSheetProps) {
  const { t } = useTranslation();
  const scanner = useScanner();
  const { state, rearm } = scanner;

  /**
   * Lo último que entró, para confirmarlo en pantalla. Sobrevive al rearme a
   * propósito: si se borrara al reabrir el sensor, la confirmación parpadearía
   * entre una lectura y la siguiente.
   */
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) setSummary(null);
  }, [visible]);

  const hit = state.phase === 'hit' ? state.result : null;

  // Un acierto se enseña y el sensor se reabre solo: encadenar lecturas es el
  // punto de un escáner. Depende solo de `hit` porque `onResolved` tiene efecto
  // —mete la línea en el carrito— y debe correr una vez por acierto, no una vez
  // por render.
  useEffect(() => {
    if (!hit) return;
    setSummary(onResolved(hit));
    const timer = setTimeout(rearm, REARM_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit]);

  return (
    <CameraStage
      visible={visible}
      onClose={onClose}
      onRead={scanner.read}
      paused={scanner.paused}
      overlay={
        <ScannerOverlay>
          {state.phase === 'miss' && state.code ? (
            <MissPanel code={state.code} onCreate={onCreateMissing} onKeepScanning={rearm} />
          ) : state.phase === 'error' ? (
            <>
              <OrbixText size="sm" style={{ color: '#fff' }}>
                {toUserMessage(state.error, t)}
              </OrbixText>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <OrbixButton label={t('common.retry')} onPress={scanner.retry} />
                </View>
                <View style={{ flex: 1 }}>
                  <OrbixButton variant="secondary" label={t('scanner.keepScanning')} onPress={rearm} />
                </View>
              </View>
            </>
          ) : (
            <>
              <OrbixText size="sm" align="center" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {state.phase === 'resolving' ? t('scanner.resolving') : t('scanner.aim')}
              </OrbixText>
              {summary ? (
                <OrbixText size="base" weight="semibold" align="center" style={{ color: '#fff' }}>
                  {summary}
                </OrbixText>
              ) : null}
              {state.count > 0 ? (
                <OrbixText size="xs" align="center" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {t('scanner.counted', { count: state.count })}
                </OrbixText>
              ) : null}
            </>
          )}
        </ScannerOverlay>
      }
    />
  );
}

function MissPanel({
  code,
  onCreate,
  onKeepScanning,
}: {
  code: string;
  onCreate?: (code: string) => void;
  onKeepScanning: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <OrbixText size="base" weight="semibold" style={{ color: '#fff' }}>
        {t('scanner.unknown.title')}
      </OrbixText>
      <OrbixText size="sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
        {t('scanner.unknown.hint', { code })}
      </OrbixText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {onCreate ? (
          <View style={{ flex: 1 }}>
            <OrbixButton label={t('scanner.unknown.create')} onPress={() => onCreate(code)} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <OrbixButton variant="secondary" label={t('scanner.keepScanning')} onPress={onKeepScanning} />
        </View>
      </View>
    </>
  );
}

export const BarcodeScannerSheet = memo(BarcodeScannerSheetComponent);

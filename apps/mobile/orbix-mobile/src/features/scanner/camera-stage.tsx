/**
 * El visor: modal a pantalla completa, permiso resuelto y botón de salir.
 *
 * Lo comparten los dos escáneres de la app, que hacen cosas distintas con lo
 * que leen —el del POS lo busca en el catálogo, el del alta solo lo copia al
 * campo— pero tienen el mismo problema de cámara: pedir el permiso en el
 * momento justo, sobrevivir a una negativa definitiva, y no quedarse sin
 * salida cuando el sensor no colabora.
 *
 * No es un bottom sheet: un visor de códigos necesita toda la altura, y media
 * pantalla obliga a acercar el teléfono hasta perder el foco.
 */
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrbixButton } from '@/components/buttons/orbix-button';
import { OrbixText } from '@/components/ui/orbix-text';
import { ScanIcon, XIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

/**
 * Los formatos que se ven en un mostrador latinoamericano. La lista es cerrada
 * a propósito: cuantos menos decodificadores corran por fotograma, antes
 * engancha el que importa, y un QR en una caja de cereal solo estorba.
 */
export const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

export interface CameraStageProps {
  visible: boolean;
  onClose: () => void;
  /** Lectura cruda de la cámara. El sensor se apaga mientras `paused`. */
  onRead: (code: string) => void;
  /**
   * Cierra el sensor de verdad: `onBarcodeScanned` pasa a `undefined` y el
   * decodificador deja de recibir fotogramas, en vez de filtrarlos después
   * —que es lo que gasta batería y calienta el teléfono.
   */
  paused: boolean;
  /** Lo que se pinta encima del visor. Se oculta mientras falte el permiso. */
  overlay?: ReactNode;
}

export function CameraStage({ visible, onClose, onRead, paused, overlay }: CameraStageProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  // Pedir el permiso al abrir, no al montar: preguntarlo antes de que el
  // usuario haya pulsado "escanear" es la forma más rápida de que lo deniegue.
  useEffect(() => {
    if (!visible) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
    // Solo el flanco de `visible`: reevaluarlo en cada cambio de permiso
    // volvería a preguntar en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleScan = ({ data }: BarcodeScanningResult) => onRead(data);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            onBarcodeScanned={paused ? undefined : handleScan}
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
            <ScanIcon size={40} color="#fff" />
            <OrbixText size="lg" weight="semibold" align="center" style={{ color: '#fff' }}>
              {t('scanner.permission.title')}
            </OrbixText>
            <OrbixText size="sm" align="center" style={{ color: 'rgba(255,255,255,0.75)', maxWidth: 280 }}>
              {t('scanner.permission.hint')}
            </OrbixText>
            <View style={{ minWidth: 220, marginTop: theme.spacing.sm }}>
              {permission?.canAskAgain ? (
                <OrbixButton
                  label={t('scanner.permission.allow')}
                  onPress={() => void requestPermission()}
                />
              ) : (
                // En iOS una negativa es definitiva desde la app: el único
                // camino es la ficha de Orbix en los ajustes del sistema.
                <OrbixButton
                  label={t('scanner.permission.openSettings')}
                  onPress={() => void Linking.openSettings()}
                />
              )}
            </View>
          </View>
        )}

        {/* Cerrar, siempre por encima: teclear el código a mano sigue siendo la
            salida cuando la cámara no colabora. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={12}
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.55)',
          }}
        >
          <XIcon size={20} color="#fff" />
        </Pressable>

        {permission?.granted ? overlay : null}
      </View>
    </Modal>
  );
}

/** La banda inferior sobre la que se explica qué está pasando. */
export function ScannerOverlay({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: 20,
        paddingBottom: 34,
        gap: 12,
        backgroundColor: 'rgba(0,0,0,0.82)',
      }}
    >
      {children}
    </View>
  );
}

/**
 * Configuración → Caja.
 *
 * Hoy solo el binding de caja física: qué cajón opera este dispositivo. Es lo
 * que evita que el binding se adquiera por carrera —`resolveCashRegister` toma
 * la primera libre por orden alfabético— y que los nombres de los cajones
 * acaben intercambiados entre días.
 *
 * Sin `OrbixScaffold` ni botón de volver: los pone la pantalla que monta el
 * panel, igual que `general-panel.tsx`.
 */
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { OrbixText } from '@/components';
import { CashRegisterPicker } from '@/features/cash/cash-register-picker';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';

export function CashPanel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { can } = usePermissions();

  // La consulta de cajas va deshabilitada sin el permiso, así que el panel
  // tiene que decirlo por su cuenta en vez de quedarse cargando para siempre.
  if (!can('cash:view')) {
    return (
      <OrbixText size="sm" tone="mutedForeground">
        {t('errors.forbidden')}
      </OrbixText>
    );
  }

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <CashRegisterPicker />
    </View>
  );
}

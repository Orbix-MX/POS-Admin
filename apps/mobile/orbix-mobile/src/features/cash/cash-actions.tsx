/**
 * Las acciones del turno, como una fila de botones tonales.
 *
 * Cada una se oculta con **su propio** permiso, no con el de la pantalla: ver
 * la caja (`cash:view`) y mover dinero son cosas distintas, y un cajero que
 * solo consulta no debería ver botones que la API le va a rechazar.
 *
 * La excepción deliberada es el arqueo y el corte: el servidor los resuelve con
 * permiso propio **o** con el PIN de un supervisor, así que ocultarlos por
 * `can()` rompería justo el caso para el que existe el PIN. Se muestran siempre
 * y la autorización se pide cuando el servidor la reclama.
 */
import { memo, type ComponentType } from 'react';
import { Pressable, View } from 'react-native';

import { OrbixText } from '@/components/ui/orbix-text';
import { Ripple, useRipple } from '@/components/animations/ripple';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeColors } from '@/theme/types';
import type { IconProps } from '@/components/ui/icons';

export interface CashAction {
  key: string;
  label: string;
  Icon: ComponentType<IconProps>;
  tintBg: keyof ThemeColors;
  tintFg: keyof ThemeColors;
  onPress: () => void;
  /** Inhabilitada con motivo: la caja está congelada, o falta permiso. */
  disabled?: boolean;
}

function ActionTile({ action }: { action: CashAction }) {
  const theme = useTheme();
  const ripple = useRipple();

  return (
    <Pressable
      onPress={action.disabled ? undefined : action.onPress}
      onPressIn={(event) => {
        if (action.disabled) return;
        ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
      }}
      disabled={action.disabled}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: Boolean(action.disabled) }}
      style={{
        flex: 1,
        minWidth: 96,
        gap: 6,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        alignItems: 'center',
        overflow: 'hidden',
        opacity: action.disabled ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: theme.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors[action.tintBg],
        }}
      >
        <action.Icon size={17} color={theme.colors[action.tintFg]} />
      </View>
      <OrbixText size="xs" weight="semibold" align="center" numberOfLines={2}>
        {action.label}
      </OrbixText>
      <Ripple {...ripple} color={theme.colors.brandBlue300} borderRadius={theme.radius.xl} />
    </Pressable>
  );
}

function CashActionsComponent({ actions }: { actions: CashAction[] }) {
  const theme = useTheme();

  if (actions.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {actions.map((action) => (
        <ActionTile key={action.key} action={action} />
      ))}
    </View>
  );
}

export const CashActions = memo(CashActionsComponent);

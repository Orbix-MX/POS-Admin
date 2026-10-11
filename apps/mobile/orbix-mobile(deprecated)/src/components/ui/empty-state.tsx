/**
 * Estado vacío con salida.
 *
 * La diferencia que justifica el componente: **una lista vacía porque el
 * negocio aún no tiene nada** necesita un botón que lo resuelva; **una lista
 * vacía porque la búsqueda no encontró** solo necesita decirlo. Antes las dos
 * se pintaban igual —un icono y una línea de texto gris— y la primera dejaba al
 * usuario nuevo sin ningún camino.
 *
 * `action` se omite cuando el usuario no tiene el permiso: un botón que va a
 * rebotar es peor que ninguno.
 */
import { memo, type ComponentType } from 'react';
import { View } from 'react-native';

import { OrbixButton } from '@/components/buttons/orbix-button';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';
import type { IconProps } from '@/components/ui/icons';

export interface EmptyStateProps {
  Icon: ComponentType<IconProps>;
  title: string;
  /** Una frase que explique por qué está vacío y qué se puede hacer. */
  hint?: string;
  action?: { label: string; onPress: () => void };
  /**
   * Una segunda salida, cuando existe y no es la obvia.
   *
   * El caso que la justifica: un catálogo vacío se puede llenar creando un
   * producto —lo normal— o importando los 400 que el negocio ya tiene en una
   * hoja de cálculo. Ofrecer solo lo primero condena a teclear.
   */
  secondaryAction?: { label: string; onPress: () => void };
}

function EmptyStateComponent({ Icon, title, hint, action, secondaryAction }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing['3xl'],
        paddingHorizontal: theme.spacing.xl,
      }}
    >
      <Icon size={34} color={theme.colors.mutedForeground} />

      <OrbixText size="base" weight="semibold" align="center">
        {title}
      </OrbixText>

      {hint ? (
        <OrbixText size="sm" tone="mutedForeground" align="center" style={{ maxWidth: 260 }}>
          {hint}
        </OrbixText>
      ) : null}

      {action ? (
        <View style={{ marginTop: theme.spacing.sm, minWidth: 200 }}>
          <OrbixButton label={action.label} onPress={action.onPress} />
        </View>
      ) : null}

      {secondaryAction ? (
        <View style={{ minWidth: 200 }}>
          <OrbixButton
            variant="secondary"
            label={secondaryAction.label}
            onPress={secondaryAction.onPress}
          />
        </View>
      ) : null}
    </View>
  );
}

export const EmptyState = memo(EmptyStateComponent);

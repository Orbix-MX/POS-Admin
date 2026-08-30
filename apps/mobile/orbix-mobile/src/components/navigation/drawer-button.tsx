/**
 * Botón de hamburguesa que abre `AppDrawer`.
 *
 * Vive en las pantallas raíz —las que no tienen nada detrás— y ocupa el sitio
 * que en una pantalla de detalle ocuparía `BackButton`, con el mismo disco de
 * 40 px para que el header no se mueva entre unas y otras.
 *
 * Estilo en objeto estático + `Ripple`, no `style={({pressed}) => …}`: con
 * nativewind + React Compiler esa forma descarta el estilo (ver
 * `google-button.tsx`).
 */
import { memo, useCallback } from 'react';
import { Pressable, type GestureResponderEvent } from 'react-native';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { MenuIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';

export interface DrawerButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}

function DrawerButtonComponent({ onPress, accessibilityLabel, size = 40 }: DrawerButtonProps) {
  const theme = useTheme();
  const ripple = useRipple();

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [ripple],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={{
        width: size,
        height: size,
        borderRadius: theme.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.muted,
        overflow: 'hidden',
      }}
    >
      <MenuIcon size={size * 0.5} color={theme.colors.foreground} />
      <Ripple {...ripple} color={theme.colors.primary} borderRadius={theme.radius.full} />
    </Pressable>
  );
}

export const DrawerButton = memo(DrawerButtonComponent);

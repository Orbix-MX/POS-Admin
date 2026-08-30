/**
 * Barra de pestañas inferior.
 *
 * Flota sobre el fondo `wash` en lugar de anclarse al borde: una franja pegada
 * abajo cortaba el degradado en seco justo donde la app es más clara.
 *
 * La sección activa es una píldora rellena con icono y etiqueta; las demás son
 * discos con solo el icono. Así el destino actual se lee de un vistazo sin
 * necesidad de cinco etiquetas compitiendo entre sí, que a este ancho o se
 * truncan o se quedan ilegibles.
 *
 * La píldora se ensancha con `LinearTransition` y la etiqueta entra con un
 * fundido: la transición la resuelve el layout, no una anchura calculada a
 * mano, así que sigue funcionando cuando los permisos ocultan pestañas o cambia
 * el idioma.
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ripple, useRipple } from '@/components/animations/ripple';
import { OrbixText } from '@/components/ui/orbix-text';
import { useTheme } from '@/hooks/use-theme';

const ITEM_HEIGHT = 44;
const ICON_SIZE = 20;
const TRANSITION = LinearTransition.duration(220);

export function OrbixTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // `href: null` (select-tenant) declara la ruta sin darle pestaña, y el
  // navegador la deja igualmente en `state.routes`: filtrarla es cosa nuestra.
  //
  // No se puede mirar `options.href`: expo-router lo consume antes de llegar
  // aquí —`const { href, ...options } = screen.options` en `TabsClient`— y lo
  // traduce a `tabBarItemStyle: { display: 'none' }`. Ese es el rastro que
  // queda, y por eso es el que se comprueba.
  const items = state.routes.flatMap((route, index) => {
    const descriptor = descriptors[route.key];
    if (!descriptor) return [];
    if (StyleSheet.flatten(descriptor.options.tabBarItemStyle)?.display === 'none') return [];
    return [{ route, options: descriptor.options, focused: state.index === index }];
  });

  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.sm,
        paddingBottom: insets.bottom + theme.spacing.sm,
      }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.xs,
            padding: theme.spacing.xs + 2,
            borderRadius: theme.radius.full,
            backgroundColor: theme.colors.card,
          },
          theme.shadows.md,
        ]}
      >
        {items.map(({ route, options, focused }) => {
          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={options.title ?? route.name}
              renderIcon={options.tabBarIcon}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabItemProps {
  focused: boolean;
  label: string;
  renderIcon: BottomTabBarProps['descriptors'][string]['options']['tabBarIcon'];
  onPress: () => void;
  onLongPress: () => void;
}

const TabItem = memo(function TabItem({
  focused,
  label,
  renderIcon,
  onPress,
  onLongPress,
}: TabItemProps) {
  const theme = useTheme();
  const ripple = useRipple();

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      ripple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY);
    },
    [ripple],
  );

  const tint = focused ? theme.colors.primaryForeground : theme.colors.mutedForeground;

  return (
    <Animated.View layout={TRANSITION} style={focused ? undefined : { flexShrink: 0 }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onLongPress={onLongPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        // Objeto estático + `Ripple`: la forma `style={({pressed}) => …}` se
        // descarta con nativewind + React Compiler (ver `google-button.tsx`).
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.xs + 2,
          height: ITEM_HEIGHT,
          // La píldora respira; el disco se queda cuadrado para ser un círculo.
          width: focused ? undefined : ITEM_HEIGHT,
          paddingHorizontal: focused ? theme.spacing.lg : 0,
          borderRadius: theme.radius.full,
          backgroundColor: focused ? theme.colors.primary : theme.colors.brandBlue50,
          overflow: 'hidden',
        }}
      >
        {renderIcon?.({ focused, color: tint, size: ICON_SIZE })}

        {focused ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(80)}>
            <OrbixText size="sm" weight="semibold" tone="primaryForeground" numberOfLines={1}>
              {label}
            </OrbixText>
          </Animated.View>
        ) : null}

        <Ripple
          {...ripple}
          color={focused ? theme.colors.onDark : theme.colors.primary}
          borderRadius={theme.radius.full}
        />
      </Pressable>
    </Animated.View>
  );
});

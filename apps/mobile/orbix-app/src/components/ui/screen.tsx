/**
 * Screen — top-level page wrapper. Paints the canvas background and applies safe
 * area insets. The rail/bottom-nav chrome is added by the (app) layout, not here.
 */
import type { PropsWithChildren } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/providers/theme-provider';

export interface ScreenProps extends PropsWithChildren {
  /** Safe-area edges to apply. Defaults to top only (bottom owned by nav). */
  edges?: Edge[];
  style?: ViewStyle;
}

export function Screen({ children, edges = ['top'], style }: ScreenProps) {
  const theme = useTheme();
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <View style={[{ flex: 1 }, style]}>{children}</View>
    </SafeAreaView>
  );
}

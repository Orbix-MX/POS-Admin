import { Platform, type ViewStyle } from 'react-native';

/**
 * Shadow presets. iOS reads shadow* props; Android uses elevation (which can't
 * tint, so the colored brand shadow degrades to a neutral elevation there).
 */
function make(
  color: string,
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
): ViewStyle {
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: { width: 0, height: offsetY },
    },
    android: { elevation },
    default: {},
  }) as ViewStyle;
}

export const shadows = {
  none: {} as ViewStyle,
  /** Soft neutral card lift. */
  card: make('#0F172A', 0.06, 6, 2, 2),
  /** Elevated surface (sheets, popovers). */
  sheet: make('#0F172A', 0.18, 24, 10, 12),
  /** Brand-tinted shadow under primary buttons. */
  primary: make('#2563EB', 0.3, 18, 8, 6),
  /** Strong lift under the floating action button. */
  fab: make('#2563EB', 0.4, 22, 10, 10),
} as const;

export type ShadowKey = keyof typeof shadows;

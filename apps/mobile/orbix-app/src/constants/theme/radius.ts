/** Corner radii (design: 8 / 12 / 16 / full). */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  '2xl': 22,
  full: 999,
} as const;

export type RadiusKey = keyof typeof radius;

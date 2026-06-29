/**
 * Phase 7 — responsive primitives.
 *
 * Drives the tablet-first layout: tablet (≥768) shows the side rail and wider
 * grids; phone uses the bottom nav and compact grids. `select` picks a value
 * per breakpoint without scattering width checks across the tree.
 */
import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = { tablet: 768, large: 1024 } as const;

export interface Responsive {
  width: number;
  height: number;
  isTablet: boolean;
  isLarge: boolean;
  isPhone: boolean;
  isLandscape: boolean;
  /** Pick a value by device class; falls back to `phone`. */
  select: <T>(opts: { phone: T; tablet?: T; large?: T }) => T;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLarge = width >= BREAKPOINTS.large;

  return {
    width,
    height,
    isTablet,
    isLarge,
    isPhone: !isTablet,
    isLandscape: width > height,
    select: ({ phone, tablet, large }) => {
      if (isLarge && large !== undefined) return large;
      if (isTablet && tablet !== undefined) return tablet;
      return phone;
    },
  };
}

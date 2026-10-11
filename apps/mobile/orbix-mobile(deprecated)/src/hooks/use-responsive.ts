/**
 * The app has been phone-first up to now — no breakpoint existed anywhere in
 * the codebase. Configuración is the first screen that needs one: a tablet
 * gets a master-detail split instead of full-screen pushes.
 *
 * 768 matches the iPad mini / common Android tablet portrait width, and is
 * the same threshold `apps/pos` (Flutter) targets in its own tablet-first
 * design — kept in sync rather than picked independently.
 */
import { useWindowDimensions } from 'react-native';

const TABLET_BREAKPOINT = 768;

export function useIsTablet(): boolean {
  const { width } = useWindowDimensions();
  return width >= TABLET_BREAKPOINT;
}

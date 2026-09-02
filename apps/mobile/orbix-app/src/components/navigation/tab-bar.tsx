/**
 * AppTabBar — responsive switch between the tablet SideRail and the phone
 * BottomNav. Passed to Expo Router's <Tabs tabBar={...}>.
 *
 * Note: the rail is rendered on the left as part of the bar; the (app) layout
 * arranges it in a row so screen content sits beside it on tablet.
 */
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useResponsive } from '@/hooks/use-responsive';
import { SideRail } from './side-rail';
import { BottomNav } from './bottom-nav';

export function AppTabBar(props: BottomTabBarProps) {
  const { isTablet } = useResponsive();
  return isTablet ? <SideRail {...props} /> : <BottomNav {...props} />;
}

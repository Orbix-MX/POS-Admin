import { Redirect, Tabs } from 'expo-router';

import { useDeviceSession } from '@/hooks/use-device-session';
import { useResponsive } from '@/hooks/use-responsive';
import { AppTabBar } from '@/components/navigation';
import { TAB_ROUTES } from '@/constants/navigation';

/**
 * Protected tab group. Requires an authorized device + signed-in operator. One
 * Tabs navigator drives both layouts: a left rail on tablet (tabBarPosition
 * 'left') and a bottom nav on phone. Defense-in-depth redirect keeps deep links
 * out when no operator is signed in.
 */
export default function AppLayout() {
  const { isBooting, hasOperator } = useDeviceSession();
  const { isTablet } = useResponsive();

  if (isBooting) return null;
  if (!hasOperator) return <Redirect href="/pin-login" />;

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isTablet ? 'left' : 'bottom',
      }}
    >
      {TAB_ROUTES.map((route) => (
        <Tabs.Screen key={route.name} name={route.name} options={{ title: route.label }} />
      ))}
    </Tabs>
  );
}

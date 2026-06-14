import { Redirect, Tabs } from 'expo-router';

import { useDeviceSession } from '@/hooks/use-device-session';
import { useResponsive } from '@/hooks/use-responsive';
import { useCapabilities } from '@/hooks/use-nav-routes';
import { primaryRoute } from '@/lib/capabilities';
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
  const capabilities = useCapabilities();

  if (isBooting) return null;
  if (!hasOperator) return <Redirect href="/pin-login" />;

  // Primary landing adapts to the tenant: Mesas when tables are active,
  // otherwise Comandas (counter / no-tables tenants).
  return (
    <Tabs
      initialRouteName={primaryRoute(capabilities)}
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

import { Redirect, Tabs } from 'expo-router';

import { useSession } from '@/providers';
import { useResponsive } from '@/hooks/use-responsive';
import { AppTabBar } from '@/components/navigation';
import { TAB_ROUTES } from '@/constants/navigation';

/**
 * Protected tab group. One Tabs navigator drives both layouts: a left rail on
 * tablet (tabBarPosition 'left') and a bottom nav on phone — both rendered by
 * the custom AppTabBar. Defense-in-depth redirect keeps deep links out.
 */
export default function AppLayout() {
  const { isAuthenticated, isLoading } = useSession();
  const { isTablet } = useResponsive();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/sign-in" />;

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

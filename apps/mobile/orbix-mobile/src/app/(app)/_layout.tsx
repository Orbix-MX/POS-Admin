/**
 * Navegación principal de la app: barra de pestañas inferior.
 *
 * Las cinco pestañas son las mismas secciones que ya ofrecía el drawer, y se
 * ocultan con las mismas comprobaciones de permiso (`href: null`): una pestaña
 * que lleva a una pantalla sin acceso es peor que no tenerla.
 *
 * `select-tenant` vive en este grupo pero no es una sección — se abre desde
 * Inicio y desde el drawer —, así que se declara con `href: null` para que
 * exista como ruta sin aparecer en la barra.
 */
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OrbixTabBar } from '@/components/navigation/orbix-tab-bar';
import {
  HomeIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { usePermissions } from '@/hooks/use-permissions';

export default function AppLayout() {
  const { t } = useTranslation();
  const { can } = usePermissions();

  return (
    <Tabs
      // La barra la dibuja el DS; el navegador solo aporta estado y navegación.
      tabBar={(props) => <OrbixTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('drawer.home'),
          tabBarIcon: ({ color, size }) => <HomeIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: t('drawer.modules.ventas'),
          tabBarIcon: ({ color, size }) => <ShoppingBagIcon size={size} color={color} />,
          href: can('orders:create') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: t('drawer.modules.clientes'),
          tabBarIcon: ({ color, size }) => <UsersIcon size={size} color={color} />,
          href: can('customers:view') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: t('drawer.modules.inventario'),
          tabBarIcon: ({ color, size }) => <PackageIcon size={size} color={color} />,
          href: can('products:view') ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('drawer.settings'),
          tabBarIcon: ({ color, size }) => <SettingsIcon size={size} color={color} />,
        }}
      />

      <Tabs.Screen name="select-tenant" options={{ href: null }} />
    </Tabs>
  );
}

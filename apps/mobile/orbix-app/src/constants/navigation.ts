import type { IconName } from '@/components/ui';

/**
 * Tab routes for the (app) group. `inRail` / `inBottomNav` control where each
 * appears per device class (tablet rail vs phone bottom nav). The phone bottom
 * nav reserves its center slot for the FAB ("Nueva comanda").
 */
export interface TabRoute {
  name: string; // file route name under app/(app)
  label: string;
  icon: IconName;
  inRail: boolean;
  inBottomNav: boolean;
}

export const TAB_ROUTES: TabRoute[] = [
  { name: 'index', label: 'Inicio', icon: 'home', inRail: true, inBottomNav: true },
  { name: 'mesas', label: 'Mesas', icon: 'tables', inRail: true, inBottomNav: true },
  { name: 'comandas', label: 'Comandas', icon: 'orders', inRail: true, inBottomNav: false },
  { name: 'cuenta', label: 'Cuenta', icon: 'bill', inRail: true, inBottomNav: true },
  { name: 'perfil', label: 'Perfil', icon: 'profile', inRail: false, inBottomNav: true },
];

/** Route the center FAB opens (most frequent action: new comanda). */
export const FAB_TARGET_ROUTE = 'comandas';

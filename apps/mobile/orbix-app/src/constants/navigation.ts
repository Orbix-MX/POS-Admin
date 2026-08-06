import type { IconName } from '@/components/ui';
import { hasTables, hasOrders, hasProducts, type Capabilities } from '@/lib/capabilities';

/**
 * Tab routes for the (app) group. `inRail` / `inBottomNav` control where each
 * appears per device class (tablet rail vs phone bottom nav). The phone bottom
 * nav reserves its center slot for the FAB ("Nueva comanda").
 *
 * `requires` decides per-tenant visibility from Capabilities. A route with no
 * `requires` is always visible (home/profile). Resolve with buildNavigation.
 */
export interface TabRoute {
  name: string; // file route name under app/(app)
  label: string;
  icon: IconName;
  inRail: boolean;
  /** Static, or resolved from Capabilities — e.g. Artículos only takes the phone
   *  bottom-nav slot freed up when Mesas isn't active. */
  inBottomNav: boolean | ((c: Capabilities) => boolean);
  requires?: (c: Capabilities) => boolean;
}

export const TAB_ROUTES: TabRoute[] = [
  { name: 'index', label: 'Inicio', icon: 'home', inRail: true, inBottomNav: true },
  { name: 'mesas', label: 'Mesas', icon: 'tables', inRail: true, inBottomNav: true, requires: hasTables },
  { name: 'comandas', label: 'Comandas', icon: 'orders', inRail: true, inBottomNav: true, requires: hasOrders },
  // El bottom nav de teléfono tiene 4 slots fijos (2 + FAB + 2). Mesas ocupa uno
  // cuando hay mesas; si no, Artículos toma ese slot libre en su lugar.
  { name: 'articulos', label: 'Artículos', icon: 'package', inRail: true, inBottomNav: (c) => !hasTables(c), requires: hasProducts },
  { name: 'perfil', label: 'Perfil', icon: 'profile', inRail: false, inBottomNav: true },
];

/**
 * Resolves the visible tab routes for the current tenant + operator. A route is
 * shown only when its `requires` predicate passes (module enabled AND permission
 * granted) — e.g. Mesas disappears entirely for counter-only / no-tables tenants.
 * `inBottomNav` is resolved to a plain boolean against the same capabilities.
 */
export function buildNavigation(capabilities: Capabilities): TabRoute[] {
  return TAB_ROUTES
    .filter((route) => !route.requires || route.requires(capabilities))
    .map((route) => ({
      ...route,
      inBottomNav: typeof route.inBottomNav === 'function' ? route.inBottomNav(capabilities) : route.inBottomNav,
    }));
}

/** Route the center FAB opens (most frequent action: new comanda). */
export const FAB_TARGET_ROUTE = 'comandas';

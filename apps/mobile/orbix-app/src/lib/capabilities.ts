/**
 * Tenant capabilities — the single source of truth for what the comandera shows
 * and lets the operator do. Every navigation, screen and flow decision derives
 * from here; NO screen should branch on a hardcoded tenant/slug.
 *
 * A capability requires BOTH:
 *   - the tenant module enabled (tenant.modules), AND
 *   - the operator permission granted (operator.permissions).
 *
 * The restaurant service mode (TABLE_SERVICE / COUNTER_SERVICE / HYBRID) further
 * gates table-based flows:
 *   - TABLE_SERVICE / HYBRID → tables visible, order opens from a table.
 *   - COUNTER_SERVICE        → no tables, order opens with a manual reference.
 */
import { SystemModule } from '@/types';
import type { DeviceTenant, RestaurantServiceMode, TenantBusinessSettings } from '@/services/device-service';

/** Canonical permission keys (mirror api permissions.constants.ts). */
export const PERMISSION = {
  ordersView: 'comanda:view',
  ordersManage: 'comanda:manage',
  tablesView: 'restaurant.tables:view',
  areasView: 'restaurant.areas:view',
  kitchenView: 'kitchen:view',
  productsView: 'products:view',
  settingsManage: 'settings:manage',
} as const;

export interface Capabilities {
  modules: string[];
  serviceMode: RestaurantServiceMode;
  permissions: string[];
  businessSettings: TenantBusinessSettings;
}

/**
 * Falls back to a sensible module set when the API didn't supply `modules`
 * (e.g. booting from a stale offline cache). Derives from the kitchen flag +
 * service mode so the app stays usable offline without hardcoding a tenant.
 */
function deriveModules(tenant: DeviceTenant | null): string[] {
  if (tenant?.modules && tenant.modules.length > 0) return tenant.modules;
  const fallback: string[] = [SystemModule.COMANDA];
  if (tenant?.restaurantServiceMode !== 'COUNTER_SERVICE') {
    fallback.push(SystemModule.RESTAURANT_TABLES, SystemModule.DINING_AREAS);
  }
  if (tenant?.kitchenEnabled) fallback.push(SystemModule.KITCHEN);
  return fallback;
}

export function buildCapabilities(
  tenant: DeviceTenant | null,
  permissions: string[],
): Capabilities {
  return {
    modules: deriveModules(tenant),
    serviceMode: tenant?.restaurantServiceMode ?? 'TABLE_SERVICE',
    permissions,
    businessSettings: tenant?.businessSettings ?? {},
  };
}

export function hasModule(c: Capabilities, module: SystemModule): boolean {
  return c.modules.includes(module);
}

export function hasPermission(c: Capabilities, permission: string): boolean {
  return c.permissions.includes(permission);
}

/** Tables visible: module enabled, not counter-only, operator can view them. */
export function hasTables(c: Capabilities): boolean {
  return (
    hasModule(c, SystemModule.RESTAURANT_TABLES) &&
    c.serviceMode !== 'COUNTER_SERVICE' &&
    hasPermission(c, PERMISSION.tablesView)
  );
}

/** Dining areas (zone filter): requires tables + the areas module/permission. */
export function hasAreas(c: Capabilities): boolean {
  return (
    hasTables(c) &&
    hasModule(c, SystemModule.DINING_AREAS) &&
    hasPermission(c, PERMISSION.areasView)
  );
}

export function hasKitchen(c: Capabilities): boolean {
  return hasModule(c, SystemModule.KITCHEN);
}

/**
 * Nodo de Caja: comandas listas para cobro se envían a caja en vez de cobrarse
 * directo en la comandera. Off (default) → el mesero cobra en ese momento, como
 * hoy. On → se oculta "Cobrar"; la cuenta queda en READY_FOR_PAYMENT y la cobra
 * la estación de Caja (web Caja Restaurante), que ya lista/cobra esas cuentas.
 */
export function hasCajaNode(c: Capabilities): boolean {
  return hasModule(c, SystemModule.CAJA_NODE);
}

/** Tenant runs both table and counter operations → order-type selector needed. */
export function isHybrid(c: Capabilities): boolean {
  return hasTables(c) && c.serviceMode === 'HYBRID';
}

/** Comandas (orders) — the operational core when COMANDA is enabled. */
export function hasOrders(c: Capabilities): boolean {
  return hasModule(c, SystemModule.COMANDA) && hasPermission(c, PERMISSION.ordersView);
}

/** Creating an order is gated by the same comanda permission server-side. */
export function canCreateOrders(c: Capabilities): boolean {
  return hasOrders(c);
}

/** Catálogo de artículos (solo lectura) — no depende de módulo, solo permiso. */
export function hasProducts(c: Capabilities): boolean {
  return hasPermission(c, PERMISSION.productsView);
}

/**
 * Comandas: pedir referencia de cuenta al abrir una orden de mostrador. Toggle de
 * negocio (Configuración → Panel de Permisos), no un permiso RBAC. Default true
 * (comportamiento actual) cuando el tenant aún no lo ha configurado.
 */
export function requiresCounterReference(c: Capabilities): boolean {
  return c.businessSettings.requireCounterReference ?? true;
}

/** Puede abrir Configuración → Panel de Permisos y cambiar los toggles. */
export function canManageSettings(c: Capabilities): boolean {
  return hasPermission(c, PERMISSION.settingsManage);
}

/**
 * Primary landing route: Mesas when tables are active, otherwise Comandas.
 * Falls back to the home dashboard when neither is available.
 */
export function primaryRoute(c: Capabilities): string {
  if (hasTables(c)) return 'mesas';
  if (hasOrders(c)) return 'comandas';
  return 'index';
}

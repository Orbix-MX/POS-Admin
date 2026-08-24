import { BusinessVertical } from '@prisma/client';

export interface RoleTemplateDef {
  /** Estable y único — se usa para aplicar (`POST /roles/templates/:key/apply`), nunca cambia una vez publicado. */
  key: string;
  vertical: BusinessVertical;
  name: string;
  description: string;
  color: string;
  permissionKeys: string[];
}

/**
 * Roles típicos por giro de negocio, listos para aplicar desde
 * Roles y Permisos → Plantillas (o auto-aplicados al hacer onboarding de un
 * tenant nuevo con ese vertical — ver `TenantsService.onboard`).
 *
 * `GYM` no tiene módulo de permisos propio todavía (no hay reservas de clase
 * ni control de membresías en el catálogo de `ALL_PERMISSIONS`) — se omite a
 * propósito en vez de inventar una plantilla sin funcionalidad real detrás.
 */
export const ROLE_TEMPLATES: RoleTemplateDef[] = [
  // ── RETAIL ──────────────────────────────────────────────────────────────
  {
    key: 'retail-cajero',
    vertical: 'RETAIL',
    name: 'Cajero',
    description: 'Cobra en el POS y abre/cierra su propio turno de caja.',
    color: '#0ea5e9',
    permissionKeys: [
      'pos:access', 'pos.cash:open', 'pos.cash:close', 'pos.cash:count',
      'orders:view', 'orders:create', 'customers:view', 'customers:create',
      'products:view', 'categories:view',
    ],
  },
  {
    key: 'retail-vendedor',
    vertical: 'RETAIL',
    name: 'Vendedor',
    description: 'Atiende clientes y arma cotizaciones, sin manejar caja.',
    color: '#22c55e',
    permissionKeys: [
      'pos:access', 'pos.quotes:create', 'pos.quotes:view', 'pos.quotes:load',
      'orders:view', 'orders:create', 'customers:view', 'customers:create', 'customers:edit',
      'products:view', 'categories:view', 'coupons:view',
    ],
  },
  {
    key: 'retail-almacen',
    vertical: 'RETAIL',
    name: 'Almacén',
    description: 'Controla inventario, compras y recepción de mercancía.',
    color: '#f59e0b',
    permissionKeys: [
      'products:view', 'products:edit', 'categories:view',
      'suppliers:view', 'purchases:view', 'purchases:create', 'purchases:send', 'purchases:receive',
      'branches:view', 'branches:inventory',
    ],
  },

  // ── RESTAURANT ──────────────────────────────────────────────────────────
  {
    key: 'restaurant-mesero',
    vertical: 'RESTAURANT',
    name: 'Mesero',
    description: 'Toma comandas y gestiona el estado de sus mesas.',
    color: '#0ea5e9',
    permissionKeys: [
      'comanda:view', 'restaurant.areas:view', 'restaurant.tables:view', 'restaurant.tables:update',
      'orders:view', 'orders:create', 'customers:view',
    ],
  },
  {
    key: 'restaurant-cocina',
    vertical: 'RESTAURANT',
    name: 'Cocina',
    description: 'Ve y gestiona las órdenes en la pantalla de cocina (KDS).',
    color: '#ef4444',
    permissionKeys: ['kitchen:view', 'kitchen:manage', 'kitchen:reject', 'comanda:view'],
  },
  {
    key: 'restaurant-cajero',
    vertical: 'RESTAURANT',
    name: 'Cajero',
    description: 'Cobra cuentas de comanda desde la estación de Caja.',
    color: '#22c55e',
    permissionKeys: ['caja:charge', 'cash:view', 'cash:manage', 'comanda:view', 'orders:view'],
  },

  // ── SERVICES ────────────────────────────────────────────────────────────
  {
    key: 'services-tecnico',
    vertical: 'SERVICES',
    name: 'Técnico',
    description: 'Atiende las órdenes de trabajo que le asignan.',
    color: '#0ea5e9',
    permissionKeys: ['work-orders:view', 'work-orders:edit', 'customers:view'],
  },
  {
    key: 'services-coordinador',
    vertical: 'SERVICES',
    name: 'Coordinador',
    description: 'Crea, asigna y da seguimiento a órdenes de trabajo y cotizaciones.',
    color: '#f59e0b',
    permissionKeys: [
      'work-orders:view', 'work-orders:create', 'work-orders:edit', 'work-orders:assign',
      'customers:view', 'customers:create', 'customers:edit',
    ],
  },
];

export function getTemplatesForVertical(vertical: BusinessVertical): RoleTemplateDef[] {
  return ROLE_TEMPLATES.filter((t) => t.vertical === vertical);
}

export function getTemplateByKey(key: string): RoleTemplateDef | undefined {
  return ROLE_TEMPLATES.find((t) => t.key === key);
}

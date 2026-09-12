/**
 * Enums mirrored from the Orbix Prisma schema
 * (`pos-admin/api/prisma/schema.prisma`). Kept as const objects rather than TS
 * `enum` so they erase cleanly and can be iterated for UI.
 */

export const TenantPlan = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  PRO: 'PRO',
  PLUS: 'PLUS',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type TenantPlan = (typeof TenantPlan)[keyof typeof TenantPlan];

export const TenantRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;
export type TenantRole = (typeof TenantRole)[keyof typeof TenantRole];

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const BusinessVertical = {
  RETAIL: 'RETAIL',
  RESTAURANT: 'RESTAURANT',
  GYM: 'GYM',
  SERVICES: 'SERVICES',
} as const;
export type BusinessVertical = (typeof BusinessVertical)[keyof typeof BusinessVertical];

export const BusinessProfile = {
  RETAIL: 'RETAIL',
  RETAIL_MANUFACTURING: 'RETAIL_MANUFACTURING',
  RESTAURANT: 'RESTAURANT',
  MANUFACTURING: 'MANUFACTURING',
  SERVICES: 'SERVICES',
  WORKSHOP: 'WORKSHOP',
} as const;
export type BusinessProfile = (typeof BusinessProfile)[keyof typeof BusinessProfile];

export const PosOperationMode = {
  QUICK_SALE: 'QUICK_SALE',
  TABLE_SERVICE: 'TABLE_SERVICE',
} as const;
export type PosOperationMode = (typeof PosOperationMode)[keyof typeof PosOperationMode];

export const TenantFeature = {
  TABLES: 'TABLES',
  KITCHEN: 'KITCHEN',
  DELIVERY: 'DELIVERY',
  MEMBERSHIPS: 'MEMBERSHIPS',
  ACCESS_CONTROL: 'ACCESS_CONTROL',
  SERVICES: 'SERVICES',
  APPOINTMENTS: 'APPOINTMENTS',
} as const;
export type TenantFeature = (typeof TenantFeature)[keyof typeof TenantFeature];

export const ProductType = {
  SIMPLE: 'SIMPLE',
  RECIPE: 'RECIPE',
  COMBO: 'COMBO',
  SERVICE: 'SERVICE',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const ProductStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

export const TaxCode = {
  IVA_16: 'IVA_16',
  IVA_11: 'IVA_11',
  IVA_8: 'IVA_8',
  EXCENTO: 'EXCENTO',
} as const;
export type TaxCode = (typeof TaxCode)[keyof typeof TaxCode];

export const CustomerStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  BLOCKED: 'BLOCKED',
} as const;
export type CustomerStatus = (typeof CustomerStatus)[keyof typeof CustomerStatus];

export const CustomerType = {
  NEW: 'NEW',
  REGULAR: 'REGULAR',
  VIP: 'VIP',
  WHOLESALE: 'WHOLESALE',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

/**
 * Cuatro estados, no dos. `EN_ARQUEO` congela la caja para contarla y
 * `PENDIENTE_REVISION` es donde queda un corte cuya diferencia superó el umbral
 * del tenant: en ambos la sesión sigue viva —`GET /cash-sessions/active` la
 * devuelve— pero no admite movimientos, que es cosa aparte del estado.
 */
export const CashSessionStatus = {
  ABIERTA: 'ABIERTA',
  EN_ARQUEO: 'EN_ARQUEO',
  PENDIENTE_REVISION: 'PENDIENTE_REVISION',
  CERRADA: 'CERRADA',
} as const;
export type CashSessionStatus = (typeof CashSessionStatus)[keyof typeof CashSessionStatus];

/** `PARCIAL`: arqueo de control con la caja abierta. `FINAL`: el del cierre. */
export const CashCountType = {
  PARCIAL: 'PARCIAL',
  FINAL: 'FINAL',
} as const;
export type CashCountType = (typeof CashCountType)[keyof typeof CashCountType];

/**
 * `WITHDRAWAL` y `REFUND` son tipos propios y no `EXPENSE`: un retiro es
 * efectivo que cambia de lugar y una devolución es dinero que vuelve al
 * cliente — ninguno de los dos es un gasto del negocio, y el corte los reporta
 * en filas distintas.
 */
export const CashMovementType = {
  SALE: 'SALE',
  CXC_PAYMENT: 'CXC_PAYMENT',
  SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  WITHDRAWAL: 'WITHDRAWAL',
  REFUND: 'REFUND',
} as const;
export type CashMovementType = (typeof CashMovementType)[keyof typeof CashMovementType];

export const OrderStatus = {
  PENDING: 'PENDING',
  LAYAWAY: 'LAYAWAY',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const OrderOrigin = {
  RETAIL_POS: 'RETAIL_POS',
  RESTAURANT_COMANDA: 'RESTAURANT_COMANDA',
  DELIVERY: 'DELIVERY',
  KIOSK: 'KIOSK',
  ONLINE: 'ONLINE',
} as const;
export type OrderOrigin = (typeof OrderOrigin)[keyof typeof OrderOrigin];

/** Divisas que maneja una sesión de caja. El fondo puede tener las dos. */
export const CashCurrency = {
  MXN: 'MXN',
  USD: 'USD',
} as const;
export type CashCurrency = (typeof CashCurrency)[keyof typeof CashCurrency];

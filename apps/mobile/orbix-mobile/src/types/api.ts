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

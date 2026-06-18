/**
 * Barrel for app-level types.
 *
 * Domain enums, plan/module maps and vertical helpers are re-exported from the
 * shared `@orbix/types` workspace package so the mobile app, the web app and the
 * API speak the same language. Anything mobile-specific (auth/session shapes)
 * lives in the local modules below.
 *
 * NOTE: only `@orbix/types` exists today. There are no shared-utils /
 * shared-validators packages yet — if those get created, re-export them here.
 */
export {
  SystemModule,
  PLAN_ORDER,
  getModulesForPlan,
  getAllowedModulesForVertical,
  isModuleCompatibleWithVertical,
} from '@orbix/types';

export type {
  TenantPlan,
  BusinessVertical,
  PosOperationMode,
  TenantFeature,
  OrderStatus,
  KitchenOrderStatus,
  PaymentMethod,
  PaymentStatus,
  Currency,
} from '@orbix/types';

export * from './auth';

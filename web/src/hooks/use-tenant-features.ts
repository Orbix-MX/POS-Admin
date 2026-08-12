import { useAuthStore } from '@/store/auth-store'

export type BusinessVertical = 'RETAIL' | 'RESTAURANT' | 'GYM' | 'SERVICES'
export type PosOperationMode = 'QUICK_SALE' | 'TABLE_SERVICE'
export type TenantFeature =
  | 'TABLES'
  | 'KITCHEN'
  | 'DELIVERY'
  | 'MEMBERSHIPS'
  | 'ACCESS_CONTROL'
  | 'SERVICES'
  | 'APPOINTMENTS'

// Re-exported from the zero-dependency module so existing imports from
// '@/hooks/use-tenant-features' keep working.
import type { BusinessProfile, BusinessFeatures } from '@/types/business-config'
export type { BusinessProfile, BusinessFeatures } from '@/types/business-config'
export { DEFAULT_BUSINESS_FEATURES } from '@/types/business-config'

export function useTenantFeatures() {
  const { businessVertical, businessProfile, posOperationMode, enabledFeatures, businessFeatures } = useAuthStore()

  const hasFeature = (feature: TenantFeature): boolean =>
    enabledFeatures.includes(feature)

  const hasPosMode = (mode: PosOperationMode): boolean =>
    posOperationMode === mode

  const hasVertical = (vertical: BusinessVertical): boolean =>
    businessVertical === vertical

  // Convergence: gate by capabilities derived from the business profile,
  // not by the operational vertical. Preferred over hasVertical for
  // module/feature availability.
  const hasBusinessFeature = (feature: keyof BusinessFeatures): boolean =>
    businessFeatures[feature] === true

  return {
    hasFeature,
    hasPosMode,
    hasVertical,
    hasBusinessFeature,
    businessVertical: businessVertical as BusinessVertical,
    businessProfile: businessProfile as BusinessProfile,
    posOperationMode: posOperationMode as PosOperationMode,
    enabledFeatures: enabledFeatures as TenantFeature[],
    businessFeatures,
  }
}

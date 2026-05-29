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

export function useTenantFeatures() {
  const { businessVertical, posOperationMode, enabledFeatures } = useAuthStore()

  const hasFeature = (feature: TenantFeature): boolean =>
    enabledFeatures.includes(feature)

  const hasPosMode = (mode: PosOperationMode): boolean =>
    posOperationMode === mode

  const hasVertical = (vertical: BusinessVertical): boolean =>
    businessVertical === vertical

  return {
    hasFeature,
    hasPosMode,
    hasVertical,
    businessVertical: businessVertical as BusinessVertical,
    posOperationMode: posOperationMode as PosOperationMode,
    enabledFeatures: enabledFeatures as TenantFeature[],
  }
}

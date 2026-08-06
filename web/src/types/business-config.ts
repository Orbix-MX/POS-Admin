// Zero-dependency module: shared business-configuration types + defaults.
// Kept import-free so it can be consumed by the auth store, services and hooks
// without creating circular imports.

// Architecture-based business profile (immutable, set at provisioning).
export type BusinessProfile =
  | 'RETAIL'
  | 'RETAIL_MANUFACTURING'
  | 'RESTAURANT'
  | 'MANUFACTURING'
  | 'SERVICES'
  | 'WORKSHOP'

// Capabilities derived from the business profile by the backend facade
// (BusinessConfigurationService). Wire contract — keep in sync with the
// backend `BusinessFeatures` interface in api/.../business-config.
export interface BusinessFeatures {
  enableInventory: boolean
  enableBranchInventory: boolean
  enableRecipes: boolean
  enableSupplies: boolean
  enableKitchen: boolean
  enableTables: boolean
  enableReservations: boolean
  enableManufacturing: boolean
  enableLots: boolean
  enableSerialNumbers: boolean
  enableScale: boolean
}

// Safe default for an unauthenticated / pre-load state: everything off, so
// gated features stay hidden until the real configuration arrives.
export const DEFAULT_BUSINESS_FEATURES: BusinessFeatures = {
  enableInventory: false,
  enableBranchInventory: false,
  enableRecipes: false,
  enableSupplies: false,
  enableKitchen: false,
  enableTables: false,
  enableReservations: false,
  enableManufacturing: false,
  enableLots: false,
  enableSerialNumbers: false,
  enableScale: false,
}

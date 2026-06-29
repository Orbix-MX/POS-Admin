import { BusinessProfile } from '@prisma/client';

/**
 * Functional configuration of a tenant's business.
 *
 * BP-02: this is pure infrastructure. The flags are initialised from the
 * tenant's BusinessProfile but NOTHING consumes them yet — no screen, query,
 * permission, validation or engine reads these values. They exist so future
 * phases can branch on configuration through BusinessConfigurationService
 * instead of inspecting the data model directly.
 */
export interface BusinessFeatures {
  enableInventory: boolean;
  enableBranchInventory: boolean;
  enableRecipes: boolean;
  enableSupplies: boolean;
  enableKitchen: boolean;
  enableTables: boolean;
  enableReservations: boolean;
  enableManufacturing: boolean;
  enableLots: boolean;
  enableSerialNumbers: boolean;
  enableScale: boolean;
}

/** Every flag off — the neutral base every profile overrides from. */
const ALL_OFF: BusinessFeatures = {
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
};

/**
 * Single source of truth: each BusinessProfile maps to its base feature set.
 * Centralised here so no module duplicates the initialisation logic.
 *
 * RETAIL is the default profile and its set is intentionally conservative —
 * inventory on (current retail behaviour), everything vertical-specific off —
 * so existing tenants keep behaving exactly as today once features are read.
 */
export const PROFILE_DEFAULT_FEATURES: Record<BusinessProfile, BusinessFeatures> = {
  RETAIL: {
    ...ALL_OFF,
    enableInventory: true,
    enableBranchInventory: true,
  },
  RETAIL_MANUFACTURING: {
    ...ALL_OFF,
    enableInventory: true,
    enableBranchInventory: true,
    enableRecipes: true,
    enableSupplies: true,
  },
  RESTAURANT: {
    ...ALL_OFF,
    enableInventory: true,
    enableBranchInventory: true,
    enableRecipes: true,
    enableSupplies: true,
    enableKitchen: true,
    enableTables: true,
  },
  MANUFACTURING: {
    ...ALL_OFF,
    enableInventory: true,
    enableBranchInventory: true,
    enableManufacturing: true,
    enableSupplies: true,
    enableLots: true,
  },
  SERVICES: {
    ...ALL_OFF,
    enableInventory: false,
  },
  WORKSHOP: {
    ...ALL_OFF,
    enableInventory: true,
    enableBranchInventory: true,
  },
};

/**
 * Build the feature set for a profile. Returns a fresh copy so callers can
 * never mutate the shared default map.
 */
export function buildFeaturesForProfile(profile: BusinessProfile): BusinessFeatures {
  return { ...PROFILE_DEFAULT_FEATURES[profile] };
}

import { BusinessProfile } from '@prisma/client';
import { BusinessFeatures } from './business-features';

/**
 * The single, unified view of a tenant's business configuration (BP-03).
 *
 * Built by exactly one place — BusinessConfigurationService.getConfiguration().
 * Every public accessor derives from this object so there is no duplicated
 * construction logic.
 *
 * Intentionally minimal for now: only `profile` and `features`. The shape is
 * an open object so later phases can add `modules`, `overrides`, `settings`,
 * `license`, … without breaking existing consumers (additive only).
 */
export interface BusinessConfiguration {
  profile: BusinessProfile;
  features: BusinessFeatures;
}

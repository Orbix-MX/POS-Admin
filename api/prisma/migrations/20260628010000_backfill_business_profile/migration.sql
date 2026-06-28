-- BP/BR convergence backfill: align business_profile with the operational
-- business_vertical for tenants still on the column default (RETAIL). This lets
-- profile-derived capabilities (enableSupplies, enableRecipes, …) match what the
-- tenant's vertical already implied, so gates that move from vertical → profile
-- keep the same observable availability.
--
-- Idempotent: only touches rows still at the default RETAIL profile, so it never
-- overrides a profile that was set explicitly. GYM has no profile equivalent and
-- stays RETAIL.

UPDATE "tenants"
SET "business_profile" = 'RESTAURANT'
WHERE "business_vertical" = 'RESTAURANT' AND "business_profile" = 'RETAIL';

UPDATE "tenants"
SET "business_profile" = 'SERVICES'
WHERE "business_vertical" = 'SERVICES' AND "business_profile" = 'RETAIL';

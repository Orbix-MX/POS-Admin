-- Data migration: assign vertical-specific default extras to existing tenants.
-- POS and COMANDA are no longer in the base plan; they are vertical extras.
-- Only updates tenants that don't already have the module in enabledModules.

-- RETAIL tenants get 'pos'
UPDATE "tenants"
SET "enabledModules" = array_append("enabledModules", 'pos')
WHERE "business_vertical" = 'RETAIL'
  AND NOT ('pos' = ANY("enabledModules"));

-- RESTAURANT tenants get 'comanda'
UPDATE "tenants"
SET "enabledModules" = array_append("enabledModules", 'comanda')
WHERE "business_vertical" = 'RESTAURANT'
  AND NOT ('comanda' = ANY("enabledModules"));

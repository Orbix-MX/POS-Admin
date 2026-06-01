-- Add inventoryUnitId and conversionFactor to supplies
-- inventoryUnitId: the operational/display unit shown to users (KG, LT, BOX)
-- conversionFactor: 1 inventoryUnit = N baseUnits (e.g., 1 KG = 1000 GR)

ALTER TABLE "supplies"
  ADD COLUMN IF NOT EXISTS "inventoryUnitId" TEXT REFERENCES "measurement_units"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(15, 6) NOT NULL DEFAULT 1;

-- Expand stock/minStock precision to support sub-gram quantities stored in base unit
ALTER TABLE "supplies"
  ALTER COLUMN "stock" TYPE DECIMAL(15, 6),
  ALTER COLUMN "minStock" TYPE DECIMAL(15, 6);

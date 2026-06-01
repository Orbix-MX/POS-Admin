-- CreateEnum UnitCategory
CREATE TYPE "UnitCategory" AS ENUM ('WEIGHT', 'VOLUME', 'COUNT');

-- CreateTable measurement_units
CREATE TABLE "measurement_units" (
    "id"         TEXT             NOT NULL,
    "name"       TEXT             NOT NULL,
    "symbol"     TEXT             NOT NULL,
    "category"   "UnitCategory"   NOT NULL,
    "baseFactor" DECIMAL(15,6)    NOT NULL DEFAULT 1,
    "isBase"     BOOLEAN          NOT NULL DEFAULT false,
    "isSystem"   BOOLEAN          NOT NULL DEFAULT true,
    CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "measurement_units_symbol_key" ON "measurement_units"("symbol");

-- CreateTable supply_allowed_units
CREATE TABLE "supply_allowed_units" (
    "id"               TEXT          NOT NULL,
    "supplyId"         TEXT          NOT NULL,
    "unitId"           TEXT          NOT NULL,
    "conversionFactor" DECIMAL(15,6) NOT NULL DEFAULT 1,
    CONSTRAINT "supply_allowed_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supply_allowed_units_supplyId_unitId_key" ON "supply_allowed_units"("supplyId", "unitId");

-- AlterTable supplies: add baseUnitId
ALTER TABLE "supplies" ADD COLUMN "baseUnitId" TEXT;

-- AlterTable recipe_items: add unitId + normalizedQuantity
ALTER TABLE "recipe_items" ADD COLUMN "unitId"             TEXT;
ALTER TABLE "recipe_items" ADD COLUMN "normalizedQuantity" DECIMAL(15,6);

-- AddForeignKey supply_allowed_units → supplies
ALTER TABLE "supply_allowed_units" ADD CONSTRAINT "supply_allowed_units_supplyId_fkey"
    FOREIGN KEY ("supplyId") REFERENCES "supplies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey supply_allowed_units → measurement_units
ALTER TABLE "supply_allowed_units" ADD CONSTRAINT "supply_allowed_units_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "measurement_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey supplies → measurement_units (baseUnitId)
ALTER TABLE "supplies" ADD CONSTRAINT "supplies_baseUnitId_fkey"
    FOREIGN KEY ("baseUnitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey recipe_items → measurement_units (unitId)
ALTER TABLE "recipe_items" ADD CONSTRAINT "recipe_items_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "measurement_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

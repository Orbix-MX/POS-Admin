-- ============================================================================
-- Variant-scoped inventory — swap the branch_inventory primary key.
--
-- The old PK [branchId, productId] allows exactly ONE inventory row per product
-- per branch, which makes it impossible to stock two variants of the same
-- product in the same branch — the entire point of variant-scoped inventory.
--
-- This swaps the PK to [branchId, variantId]. No column is dropped: `productId`
-- stays (NOT NULL, still FK'd to products) as a denormalized parent pointer and
-- keeps its own non-unique index for the legacy product-keyed lookups.
--
-- Safe because the expand migration backfilled `variantId` on every row.
-- ============================================================================

-- Guard: refuse to run if any row is still missing its variant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "branch_inventory" WHERE "variantId" IS NULL) THEN
    RAISE EXCEPTION 'branch_inventory has rows with a NULL variantId; run the expand backfill first';
  END IF;
END $$;

ALTER TABLE "branch_inventory" ALTER COLUMN "variantId" SET NOT NULL;

-- The unique index from the expand phase is superseded by the new primary key.
DROP INDEX IF EXISTS "branch_inventory_branchId_variantId_key";

ALTER TABLE "branch_inventory" DROP CONSTRAINT "branch_inventory_pkey";
ALTER TABLE "branch_inventory" ADD CONSTRAINT "branch_inventory_pkey"
  PRIMARY KEY ("branchId", "variantId");

-- [branchId, productId] is no longer unique (a product may now hold several
-- variant rows per branch), but it stays indexed for lookups by product.
CREATE INDEX "branch_inventory_branchId_productId_idx"
  ON "branch_inventory" ("branchId", "productId");

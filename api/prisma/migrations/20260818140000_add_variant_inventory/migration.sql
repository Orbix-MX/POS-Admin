-- ============================================================================
-- Variant-scoped inventory — EXPAND phase (additive only, no data destroyed).
--
-- Moves the commercial data of a sellable line (stock, cost, price) onto
-- branch_inventory keyed by branch + variant. Every product gets exactly one
-- `isDefault` variant (name = NULL) representing "the product itself", which is
-- what carries the stock of products never split into named variants.
--
-- NOTHING is dropped here on purpose: products.stock/price/costPrice/
-- comparePrice/lastCost/avgCost/lowStockAlert/trackInventory, the legacy
-- product_variants.cost/price, and branch_inventory's [branchId, productId]
-- primary key all stay in place so existing product-keyed code keeps working
-- and the change stays revertible. The CONTRACT migration (swap the PK to
-- [branchId, variantId], drop productId and the legacy columns) comes later,
-- once the application code reads exclusively from the new shape.
-- ============================================================================

-- ── 1. ProductVariant: default-variant identity + inventory policy ──────────
-- `name` becomes nullable: the default variant has no name by definition.
ALTER TABLE "product_variants" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "product_variants" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product_variants" ADD COLUMN "trackInventory" BOOLEAN NOT NULL DEFAULT true;

-- ── 2. One default variant per product ──────────────────────────────────────
-- Seeded from the product's current commercial values so the default variant is
-- a faithful stand-in for the product from day one.
INSERT INTO "product_variants" (
  "id", "productId", "name", "isDefault", "trackInventory", "cost", "price", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  NULL,
  true,
  p."trackInventory",
  COALESCE(p."costPrice", 0),
  p."price",
  NOW(),
  NOW()
FROM "products" p
WHERE NOT EXISTS (
  SELECT 1 FROM "product_variants" v
  WHERE v."productId" = p."id" AND v."isDefault"
);

-- Enforce the "exactly one default per product" invariant in the database.
CREATE UNIQUE INDEX "product_variants_default_per_product"
  ON "product_variants" ("productId")
  WHERE "isDefault";

-- ── 3. BranchInventory: variant link + commercial columns ───────────────────
-- Nullable on purpose: a missing backfill must be visible, not read as 0.
ALTER TABLE "branch_inventory" ADD COLUMN "variantId" TEXT;
ALTER TABLE "branch_inventory" ADD COLUMN "cost" DECIMAL(10,2);
ALTER TABLE "branch_inventory" ADD COLUMN "price" DECIMAL(10,2);
ALTER TABLE "branch_inventory" ADD COLUMN "comparePrice" DECIMAL(10,2);
ALTER TABLE "branch_inventory" ADD COLUMN "lastCost" DECIMAL(10,2);
ALTER TABLE "branch_inventory" ADD COLUMN "avgCost" DECIMAL(10,2);
ALTER TABLE "branch_inventory" ADD COLUMN "lowStockAlert" INTEGER NOT NULL DEFAULT 5;

-- ── 4. Make each tenant's main branch resolvable ────────────────────────────
-- Stock is branch-scoped now, so the code needs a well-defined "main" branch to
-- fall back to. This only sets a flag on a branch that already exists — no
-- branch is created here by design: a tenant with no branches simply gets no
-- variant inventory (step 6 joins on `branches`, so it yields no rows for them)
-- until it creates one. Nothing breaks meanwhile, because the legacy
-- products.stock column is still in place and still authoritative.
UPDATE "branches" SET "isMain" = true
WHERE "id" IN (
  SELECT DISTINCT ON (b."tenantId") b."id"
  FROM "branches" b
  WHERE NOT EXISTS (
    SELECT 1 FROM "branches" m
    WHERE m."tenantId" = b."tenantId" AND m."isMain"
  )
  ORDER BY b."tenantId", b."createdAt", b."id"
);

-- ── 5. Point existing branch_inventory rows at the default variant ──────────
UPDATE "branch_inventory" bi
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = bi."productId"
  AND v."isDefault"
  AND bi."variantId" IS NULL;

-- ── 6. Seed a row for every (active branch × default variant) pair ──────────
-- Without this, a product would be unsellable in any branch that has no row —
-- it would have no price and no stock there.
INSERT INTO "branch_inventory" (
  "branchId", "productId", "variantId", "stock",
  "cost", "price", "comparePrice", "lastCost", "avgCost", "lowStockAlert", "updatedAt"
)
SELECT
  b."id",
  p."id",
  v."id",
  p."stock",
  COALESCE(p."costPrice", 0),
  p."price",
  p."comparePrice",
  p."lastCost",
  p."avgCost",
  p."lowStockAlert",
  NOW()
FROM "products" p
JOIN "product_variants" v ON v."productId" = p."id" AND v."isDefault"
JOIN "branches" b ON b."tenantId" = p."tenantId" AND b."status" = 'ACTIVE'
WHERE NOT EXISTS (
  SELECT 1 FROM "branch_inventory" bi
  WHERE bi."branchId" = b."id" AND bi."productId" = p."id"
);

-- ── 7. Backfill commercial values on pre-existing rows ──────────────────────
-- Their `stock` is already branch-specific and authoritative, so it is left
-- untouched; only the new commercial columns are filled in.
UPDATE "branch_inventory" bi
SET
  "cost"          = COALESCE(p."costPrice", 0),
  "price"         = p."price",
  "comparePrice"  = p."comparePrice",
  "lastCost"      = p."lastCost",
  "avgCost"       = p."avgCost",
  "lowStockAlert" = p."lowStockAlert"
FROM "products" p
WHERE p."id" = bi."productId"
  AND bi."price" IS NULL;

-- ── 8. Constraints: FK + the [branchId, variantId] access path ──────────────
ALTER TABLE "branch_inventory"
  ADD CONSTRAINT "branch_inventory_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "branch_inventory_branchId_variantId_key"
  ON "branch_inventory" ("branchId", "variantId");

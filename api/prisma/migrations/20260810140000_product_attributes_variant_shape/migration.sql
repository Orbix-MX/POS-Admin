-- Re-applies the per-product attribute design (productId/name/cost/price).
-- A teammate's `prisma migrate dev` run (see 20260808183000_fix_product_attributes_drift)
-- reverted the live table back to the older tenant-catalog shape
-- (tenantId/slug/type/options/...) because that migration had never been
-- committed here — it only existed applied directly against the shared dev
-- database. This migration makes the change permanent by committing it
-- properly. Both tables were confirmed empty before writing this (0 rows) —
-- safe to drop and recreate.

-- DropTable (child first — has FKs to both product_attributes and products)
DROP TABLE IF EXISTS "product_attribute_values" CASCADE;

-- DropTable (old shape: tenant-scoped catalog)
DROP TABLE IF EXISTS "product_attributes" CASCADE;

-- DropEnum
DROP TYPE IF EXISTS "ProductAttributeType";

-- CreateTable (new shape: per-product line with its own cost/price)
CREATE TABLE "product_attributes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

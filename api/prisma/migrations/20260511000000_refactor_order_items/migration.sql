-- Rename productName → name (preserves data)
ALTER TABLE "order_items" RENAME COLUMN "productName" TO "name";

-- Rename productSku → sku and make nullable (preserves data)
ALTER TABLE "order_items" RENAME COLUMN "productSku" TO "sku";
ALTER TABLE "order_items" ALTER COLUMN "sku" DROP NOT NULL;

-- Add new columns
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "tax" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill subtotal for existing rows: (quantity * price) - discount
UPDATE "order_items"
SET "subtotal" = GREATEST(0, ("quantity"::decimal * "price") - "discount");

-- Ensure total is consistent with new formula for existing rows
UPDATE "order_items"
SET "total" = "subtotal" + "tax";

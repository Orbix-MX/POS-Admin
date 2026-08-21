-- Renames product_attributes to product_variants (same shape: per-product
-- line with its own cost/price) — the concept was always a variant/modifier,
-- not a reusable attribute catalog.

ALTER TABLE "product_attributes" RENAME TO "product_variants";
ALTER TABLE "product_variants" RENAME CONSTRAINT "product_attributes_pkey" TO "product_variants_pkey";
ALTER TABLE "product_variants" RENAME CONSTRAINT "product_attributes_productId_fkey" TO "product_variants_productId_fkey";

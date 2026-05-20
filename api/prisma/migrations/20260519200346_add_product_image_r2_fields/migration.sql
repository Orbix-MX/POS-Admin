-- AlterTable: add R2 storage fields to product_images
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "key" TEXT;
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
ALTER TABLE "product_images" ADD COLUMN IF NOT EXISTS "size" INTEGER;

-- Add itemType, productId, sku to service_quote_items for mixed product/service quotes
ALTER TABLE "service_quote_items"
  ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'SERVICE',
  ADD COLUMN IF NOT EXISTS "productId" TEXT,
  ADD COLUMN IF NOT EXISTS "sku" TEXT;

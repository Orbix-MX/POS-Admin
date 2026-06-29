-- CreateEnum
CREATE TYPE "KitchenOrderStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PAUSED', 'READY', 'REJECTED', 'DELIVERED');

-- AlterTable: add kitchen status fields to orders
ALTER TABLE "orders"
  ADD COLUMN "kitchenStatus"           "KitchenOrderStatus",
  ADD COLUMN "kitchenStartedAt"        TIMESTAMP(3),
  ADD COLUMN "kitchenReadyAt"          TIMESTAMP(3),
  ADD COLUMN "kitchenPausedAt"         TIMESTAMP(3),
  ADD COLUMN "kitchenRejectedAt"       TIMESTAMP(3),
  ADD COLUMN "kitchenRejectedById"     TEXT,
  ADD COLUMN "kitchenRejectionComment" TEXT;

-- Backfill: set kitchenStatus=PENDING for existing pending table orders (restaurant comandas)
UPDATE "orders"
SET "kitchenStatus" = 'PENDING'
WHERE "tableNumber" IS NOT NULL
  AND "paymentStatus" = 'PENDING'
  AND "kitchenStatus" IS NULL;

-- Backfill: add 'kitchen' module to existing RESTAURANT tenants that don't have it yet
UPDATE "tenants"
SET "enabledModules" = array_append("enabledModules", 'kitchen')
WHERE "business_vertical" = 'RESTAURANT'
  AND NOT ('kitchen' = ANY("enabledModules"));

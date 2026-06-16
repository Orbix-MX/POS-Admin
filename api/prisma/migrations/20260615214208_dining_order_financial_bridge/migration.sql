-- Financial bridge: optional, unique link from a DiningOrder to its financial Order.
-- Additive and non-destructive: nullable column, no data migration, ON DELETE SET NULL.

-- AlterTable
ALTER TABLE "dining_orders" ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "dining_orders_orderId_key" ON "dining_orders"("orderId");

-- AddForeignKey
ALTER TABLE "dining_orders" ADD CONSTRAINT "dining_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

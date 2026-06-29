-- CreateEnum
CREATE TYPE "DiningOrderStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "dining_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "status" "DiningOrderStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dining_orders_tenantId_branchId_status_idx" ON "dining_orders"("tenantId", "branchId", "status");

-- CreateIndex
CREATE INDEX "dining_orders_tableId_status_idx" ON "dining_orders"("tableId", "status");

-- AddForeignKey
ALTER TABLE "dining_orders" ADD CONSTRAINT "dining_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_orders" ADD CONSTRAINT "dining_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_orders" ADD CONSTRAINT "dining_orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_orders" ADD CONSTRAINT "dining_orders_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "employees"("id") ON UPDATE CASCADE;

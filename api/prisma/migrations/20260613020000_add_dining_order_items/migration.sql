-- CreateTable
CREATE TABLE "dining_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dining_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dining_order_items_orderId_idx" ON "dining_order_items"("orderId");

-- AddForeignKey
ALTER TABLE "dining_order_items" ADD CONSTRAINT "dining_order_items_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "dining_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

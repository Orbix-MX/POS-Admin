-- Item-level refund breakdown. Additive and non-destructive: new table only.

-- CreateTable
CREATE TABLE "order_refund_items" (
    "id" TEXT NOT NULL,
    "refundId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_refund_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_refund_items_orderItemId_idx" ON "order_refund_items"("orderItemId");

-- CreateIndex
CREATE INDEX "order_refund_items_refundId_idx" ON "order_refund_items"("refundId");

-- AddForeignKey
ALTER TABLE "order_refund_items" ADD CONSTRAINT "order_refund_items_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "order_refunds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_refund_items" ADD CONSTRAINT "order_refund_items_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "StoreWhatsappOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "store_whatsapp_orders" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" "StoreWhatsappOrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_whatsapp_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_whatsapp_order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_whatsapp_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "store_whatsapp_orders_tenantId_orderNumber_key" ON "store_whatsapp_orders"("tenantId", "orderNumber");

-- AddForeignKey
ALTER TABLE "store_whatsapp_orders" ADD CONSTRAINT "store_whatsapp_orders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_whatsapp_order_items" ADD CONSTRAINT "store_whatsapp_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "store_whatsapp_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_whatsapp_order_items" ADD CONSTRAINT "store_whatsapp_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

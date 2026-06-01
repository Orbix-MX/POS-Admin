-- CreateEnum
CREATE TYPE "OrderOrigin" AS ENUM ('RETAIL_POS', 'RESTAURANT_COMANDA', 'DELIVERY', 'KIOSK', 'ONLINE');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "orderOrigin" "OrderOrigin";

-- CreateEnum
CREATE TYPE "DiningServiceType" AS ENUM ('DINE_IN', 'COUNTER');

-- CreateEnum
CREATE TYPE "RestaurantServiceMode" AS ENUM ('TABLE_SERVICE', 'COUNTER_SERVICE', 'HYBRID');

-- AlterTable: add restaurantServiceMode to tenants
ALTER TABLE "tenants" ADD COLUMN "restaurant_service_mode" "RestaurantServiceMode" NOT NULL DEFAULT 'TABLE_SERVICE';

-- AlterTable: add serviceType, make tableId nullable
ALTER TABLE "dining_orders" ADD COLUMN "service_type" "DiningServiceType" NOT NULL DEFAULT 'DINE_IN';
ALTER TABLE "dining_orders" ALTER COLUMN "tableId" DROP NOT NULL;

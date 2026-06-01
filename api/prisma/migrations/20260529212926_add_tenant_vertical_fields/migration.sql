-- CreateEnum
CREATE TYPE "BusinessVertical" AS ENUM ('RETAIL', 'RESTAURANT', 'GYM', 'SERVICES');

-- CreateEnum
CREATE TYPE "PosOperationMode" AS ENUM ('QUICK_SALE', 'TABLE_SERVICE');

-- CreateEnum
CREATE TYPE "TenantFeature" AS ENUM ('TABLES', 'KITCHEN', 'DELIVERY', 'MEMBERSHIPS', 'ACCESS_CONTROL', 'SERVICES', 'APPOINTMENTS');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "business_vertical" "BusinessVertical" NOT NULL DEFAULT 'RETAIL',
ADD COLUMN     "enabled_features" "TenantFeature"[] DEFAULT ARRAY[]::"TenantFeature"[],
ADD COLUMN     "pos_operation_mode" "PosOperationMode" NOT NULL DEFAULT 'QUICK_SALE';

-- CreateEnum
CREATE TYPE "BusinessProfile" AS ENUM ('RETAIL', 'RETAIL_MANUFACTURING', 'RESTAURANT', 'MANUFACTURING', 'SERVICES', 'WORKSHOP');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "business_profile" "BusinessProfile" NOT NULL DEFAULT 'RETAIL';

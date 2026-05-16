-- AlterTable: add enabledModules to tenants
ALTER TABLE "tenants" ADD COLUMN "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

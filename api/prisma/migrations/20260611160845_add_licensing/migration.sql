-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('WEB', 'POS_DESKTOP', 'MOBILE_COMANDERA', 'OTHER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'REVOKED', 'PENDING');

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "license_key" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'TRIAL',
    "plan" "TenantPlan" NOT NULL DEFAULT 'FREE',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "max_users" INTEGER,
    "max_branches" INTEGER,
    "max_devices" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "license_id" TEXT,
    "device_id" TEXT NOT NULL,
    "name" TEXT,
    "type" "DeviceType" NOT NULL DEFAULT 'OTHER',
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMP(3),
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE INDEX "licenses_tenant_id_status_idx" ON "licenses"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "devices_tenant_id_device_id_key" ON "devices"("tenant_id", "device_id");

-- CreateIndex
CREATE INDEX "devices_tenant_id_status_idx" ON "devices"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing tenant gets a current license mirroring its plan/status.
-- Perpetual (expires_at NULL) except trials, which inherit trialEndsAt.
INSERT INTO "licenses" ("id", "tenant_id", "license_key", "status", "plan", "starts_at", "expires_at", "max_users", "max_branches", "max_devices", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    t."id",
    'ORBX-' || replace(gen_random_uuid()::text, '-', ''),
    (CASE t."status"
        WHEN 'ACTIVE' THEN 'ACTIVE'
        WHEN 'TRIAL' THEN 'TRIAL'
        WHEN 'SUSPENDED' THEN 'SUSPENDED'
        WHEN 'CANCELLED' THEN 'CANCELLED'
        WHEN 'EXPIRED' THEN 'EXPIRED'
        ELSE 'SUSPENDED'
    END)::"LicenseStatus",
    t."plan",
    t."createdAt",
    (CASE WHEN t."status" = 'TRIAL' THEN t."trialEndsAt" ELSE NULL END),
    t."user_limit_override",
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tenants" t;

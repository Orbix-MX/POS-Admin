-- AlterTable: Device — durable credential + client metadata
ALTER TABLE "devices" ADD COLUMN "device_token" TEXT;
ALTER TABLE "devices" ADD COLUMN "model" TEXT;
ALTER TABLE "devices" ADD COLUMN "os" TEXT;
ALTER TABLE "devices" ADD COLUMN "app_version" TEXT;

-- Backfill a device token for every existing device so validate() can return one.
UPDATE "devices"
SET "device_token" = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE "device_token" IS NULL;

CREATE UNIQUE INDEX "devices_device_token_key" ON "devices"("device_token");

-- AlterTable: Employee — operative PIN + role link
ALTER TABLE "employees" ADD COLUMN "pin_hash" TEXT;
ALTER TABLE "employees" ADD COLUMN "role_id" TEXT;

CREATE UNIQUE INDEX "employees_tenantId_pin_hash_key" ON "employees"("tenantId", "pin_hash");

ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_fkey"
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

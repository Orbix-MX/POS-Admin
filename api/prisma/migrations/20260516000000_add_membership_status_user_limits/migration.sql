-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED');

-- AlterTable
ALTER TABLE "tenant_memberships" ADD COLUMN     "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "over_user_limit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "owner_user_id" TEXT,
ADD COLUMN     "user_limit_override" INTEGER;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill protected owner: the earliest OWNER membership of each tenant
UPDATE "tenants" t
SET "owner_user_id" = sub."userId"
FROM (
  SELECT DISTINCT ON ("tenantId") "tenantId", "userId"
  FROM "tenant_memberships"
  WHERE "role" = 'OWNER'
  ORDER BY "tenantId", "assignedAt" ASC
) sub
WHERE t."id" = sub."tenantId" AND t."owner_user_id" IS NULL;

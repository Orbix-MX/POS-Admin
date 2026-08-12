-- CreateEnum
CREATE TYPE "RestaurantVisibilityMode" AS ENUM ('SHARED', 'OWN_ONLY', 'OWN_WITH_SUPERVISOR');

-- AlterTable
-- Per-branch waiter command visibility. Default SHARED preserves current
-- behavior (every operator sees every active DiningOrder). Infra only: no
-- filtering is enforced yet (see DiningOrdersService.resolveVisibilityWhere).
ALTER TABLE "branches" ADD COLUMN "restaurant_visibility_mode" "RestaurantVisibilityMode" NOT NULL DEFAULT 'SHARED';

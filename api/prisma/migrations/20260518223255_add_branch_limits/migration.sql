-- AlterEnum
ALTER TYPE "BranchStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "extra_branch_limit" INTEGER DEFAULT 0;

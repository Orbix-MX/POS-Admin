-- AlterTable: bind a device to a branch
ALTER TABLE "devices" ADD COLUMN "branch_id" TEXT;

ALTER TABLE "devices" ADD CONSTRAINT "devices_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_branch_selected_id" TEXT,
ADD COLUMN     "last_tenant_selected_id" TEXT;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_last_tenant_selected_id_fkey" FOREIGN KEY ("last_tenant_selected_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_last_branch_selected_id_fkey" FOREIGN KEY ("last_branch_selected_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

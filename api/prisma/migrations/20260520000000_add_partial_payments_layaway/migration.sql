-- Add PARTIALLY_PAID to PaymentStatus enum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';

-- Add LAYAWAY to OrderStatus enum
ALTER TYPE "OrderStatus" ADD VALUE 'LAYAWAY';

-- CreateEnum
CREATE TYPE "PaymentConcept" AS ENUM ('SALE', 'DOWN_PAYMENT', 'LAYAWAY_DEPOSIT', 'BALANCE_PAYMENT');

-- AlterTable: payments
ALTER TABLE "payments" ADD COLUMN "paymentConcept" "PaymentConcept" NOT NULL DEFAULT 'SALE';
ALTER TABLE "payments" ADD COLUMN "createdById" TEXT;
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

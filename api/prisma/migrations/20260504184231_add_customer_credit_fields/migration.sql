-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "creditDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditLimit" DECIMAL(10,2),
ADD COLUMN     "hasCredit" BOOLEAN NOT NULL DEFAULT false;

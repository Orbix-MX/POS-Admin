/*
  Warnings:

  - You are about to drop the column `taxAmount` on the `products` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TaxCode" AS ENUM ('IVA_16', 'IVA_11', 'IVA_8', 'EXCENTO');

-- AlterTable
ALTER TABLE "products" DROP COLUMN "taxAmount",
ADD COLUMN     "taxCode" "TaxCode";

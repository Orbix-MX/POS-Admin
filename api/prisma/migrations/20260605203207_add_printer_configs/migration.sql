-- CreateEnum
CREATE TYPE "PrinterType" AS ENUM ('TICKET', 'LABEL', 'REPORT');

-- CreateEnum
CREATE TYPE "PrinterConnection" AS ENUM ('USB', 'NETWORK', 'BLUETOOTH', 'SYSTEM');

-- CreateTable
CREATE TABLE "printer_configs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "type" "PrinterType" NOT NULL DEFAULT 'TICKET',
    "connectionType" "PrinterConnection" NOT NULL DEFAULT 'NETWORK',
    "ipAddress" TEXT,
    "port" INTEGER,
    "usbPath" TEXT,
    "systemName" TEXT,
    "paperWidth" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printer_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "printer_configs_tenantId_idx" ON "printer_configs"("tenantId");

-- CreateIndex
CREATE INDEX "printer_configs_branchId_idx" ON "printer_configs"("branchId");

-- AddForeignKey
ALTER TABLE "printer_configs" ADD CONSTRAINT "printer_configs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "printer_configs" ADD CONSTRAINT "printer_configs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

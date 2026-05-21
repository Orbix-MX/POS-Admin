-- Add PARTIALLY_REFUNDED to PaymentStatus enum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- Create order_refunds table
CREATE TABLE "order_refunds" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "amount"          DECIMAL(10,2) NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'MXN',
  "refundMethod"    TEXT NOT NULL,
  "originalMethod"  TEXT,
  "reason"          TEXT NOT NULL,
  "restoreInventory" BOOLEAN NOT NULL DEFAULT false,
  "windowOverride"  BOOLEAN NOT NULL DEFAULT false,
  "notes"           TEXT,
  "cashMovementId"  TEXT,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "order_refunds"
  ADD CONSTRAINT "order_refunds_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_refunds"
  ADD CONSTRAINT "order_refunds_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_refunds"
  ADD CONSTRAINT "order_refunds_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index
CREATE INDEX "order_refunds_tenantId_orderId_idx" ON "order_refunds"("tenantId", "orderId");

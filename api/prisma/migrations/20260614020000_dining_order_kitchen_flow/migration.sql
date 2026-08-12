-- Extend DiningOrderStatus with kitchen + no-kitchen flow states.
-- ADD VALUE statements cannot run inside a transaction block; Prisma applies
-- each statement separately, and IF NOT EXISTS keeps this idempotent.
ALTER TYPE "DiningOrderStatus" ADD VALUE IF NOT EXISTS 'SENT_TO_KITCHEN';
ALTER TYPE "DiningOrderStatus" ADD VALUE IF NOT EXISTS 'IN_PREPARATION';
ALTER TYPE "DiningOrderStatus" ADD VALUE IF NOT EXISTS 'READY';
ALTER TYPE "DiningOrderStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "DiningOrderStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PAYMENT';
ALTER TYPE "DiningOrderStatus" ADD VALUE IF NOT EXISTS 'PAID';

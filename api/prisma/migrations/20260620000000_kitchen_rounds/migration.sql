-- CreateEnum
CREATE TYPE "KitchenRoundStatus" AS ENUM ('SENT', 'IN_PREPARATION', 'DONE');

-- CreateTable
CREATE TABLE "kitchen_rounds" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "status" "KitchenRoundStatus" NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kitchen_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchen_rounds_order_id_idx" ON "kitchen_rounds"("order_id");

-- AddForeignKey
ALTER TABLE "kitchen_rounds" ADD CONSTRAINT "kitchen_rounds_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "dining_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add kitchen_round_id to dining_order_items
ALTER TABLE "dining_order_items" ADD COLUMN "kitchen_round_id" TEXT;

-- AddForeignKey
ALTER TABLE "dining_order_items" ADD CONSTRAINT "dining_order_items_kitchen_round_id_fkey"
    FOREIGN KEY ("kitchen_round_id") REFERENCES "kitchen_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

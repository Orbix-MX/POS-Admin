-- Ronda de envío por ítem: NULL = pendiente, fecha = ya enviado a cocina/caja.
ALTER TABLE "dining_order_items" ADD COLUMN "sent_to_kitchen_at" TIMESTAMP(3);

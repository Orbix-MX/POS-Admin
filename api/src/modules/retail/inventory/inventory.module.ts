import { Module } from '@nestjs/common';
import { InventoryConsumptionEngine } from './inventory-consumption.engine';

/**
 * Shared module exposing the single inventory consumption engine. Imported by
 * any module that moves stock through sales or reversals (orders, restaurant).
 */
@Module({
  providers: [InventoryConsumptionEngine],
  exports: [InventoryConsumptionEngine],
})
export class InventoryModule {}

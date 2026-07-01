import { Module } from '@nestjs/common';
import { InventoryConsumptionEngine } from './inventory-consumption.engine';
import { InventoryEngine } from './inventory.engine';

/**
 * Shared module exposing the inventory engines. Imported by any module that
 * moves stock through sales or reversals (orders, restaurant).
 *
 * - InventoryConsumptionEngine: motor actual de consumo por ventas/reversas.
 * - InventoryEngine (Fase 1): futura puerta única para modificar existencias.
 *   Se exporta desde ya para habilitar su adopción incremental en fases
 *   posteriores; en Fase 1 encapsula los primitivos comunes sin reemplazar a
 *   ningún llamador.
 */
@Module({
  providers: [InventoryConsumptionEngine, InventoryEngine],
  exports: [InventoryConsumptionEngine, InventoryEngine],
})
export class InventoryModule {}

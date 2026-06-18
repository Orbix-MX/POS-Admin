import { Module } from '@nestjs/common';
import { DiningOrdersController } from './dining-orders.controller';
import { DiningOrdersService } from './dining-orders.service';
import { InventoryModule } from '../../retail/inventory/inventory.module';
import { CheckoutModule } from '../../retail/checkout/checkout.module';

@Module({
  imports: [InventoryModule, CheckoutModule],
  controllers: [DiningOrdersController],
  providers: [DiningOrdersService],
  exports: [DiningOrdersService],
})
export class DiningOrdersModule {}

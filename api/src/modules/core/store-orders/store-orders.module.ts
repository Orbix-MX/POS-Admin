import { Module } from '@nestjs/common';
import { StoreOrdersController } from './store-orders.controller';
import { StoreOrdersService } from './store-orders.service';
import { InventoryModule } from '../../retail/inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [StoreOrdersController],
  providers: [StoreOrdersService],
  exports: [StoreOrdersService],
})
export class StoreOrdersModule {}

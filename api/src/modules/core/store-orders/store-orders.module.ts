import { Module } from '@nestjs/common';
import { StoreOrdersController } from './store-orders.controller';
import { StoreOrdersService } from './store-orders.service';

@Module({
  controllers: [StoreOrdersController],
  providers: [StoreOrdersService],
  exports: [StoreOrdersService],
})
export class StoreOrdersModule {}

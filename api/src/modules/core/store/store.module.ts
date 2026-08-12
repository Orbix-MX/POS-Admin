import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { StoreOrdersModule } from '../store-orders/store-orders.module';

@Module({
  imports: [StoreOrdersModule],
  controllers: [StoreController],
  providers: [StoreService],
})
export class StoreModule {}

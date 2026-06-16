import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { EmailModule } from '../../core/email/email.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [CouponsModule, EmailModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

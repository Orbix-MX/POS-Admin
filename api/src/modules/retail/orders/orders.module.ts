import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { EmailModule } from '../../core/email/email.module';

@Module({
  imports: [CouponsModule, EmailModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

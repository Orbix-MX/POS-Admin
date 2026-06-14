import { Module } from '@nestjs/common';
import { DiningOrdersController } from './dining-orders.controller';
import { DiningOrdersService } from './dining-orders.service';

@Module({
  controllers: [DiningOrdersController],
  providers: [DiningOrdersService],
})
export class DiningOrdersModule {}

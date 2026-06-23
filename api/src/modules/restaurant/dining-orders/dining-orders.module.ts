import { Module } from '@nestjs/common';
import { DiningOrdersController } from './dining-orders.controller';
import { DiningOrdersService } from './dining-orders.service';
import { RestaurantVisibilityService } from '../visibility/restaurant-visibility.service';
import { InventoryModule } from '../../retail/inventory/inventory.module';
import { CheckoutModule } from '../../retail/checkout/checkout.module';

@Module({
  imports: [InventoryModule, CheckoutModule],
  controllers: [DiningOrdersController],
  providers: [DiningOrdersService, RestaurantVisibilityService],
  exports: [DiningOrdersService, RestaurantVisibilityService],
})
export class DiningOrdersModule {}

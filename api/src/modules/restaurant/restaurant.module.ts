import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';
import { DiningAreasModule } from './dining-areas/dining-areas.module';
import { TablesModule } from './tables/tables.module';
import { DiningOrdersModule } from './dining-orders/dining-orders.module';
import { InventoryModule } from '../retail/inventory/inventory.module';
import { CheckoutModule } from '../retail/checkout/checkout.module';

@Module({
  imports: [DiningAreasModule, TablesModule, DiningOrdersModule, InventoryModule, CheckoutModule],
  controllers: [RestaurantController, KitchenController],
  providers: [RestaurantService, KitchenService],
})
export class RestaurantModule {}

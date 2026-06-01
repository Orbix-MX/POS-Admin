import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { KitchenController } from './kitchen.controller';
import { KitchenService } from './kitchen.service';

@Module({
  controllers: [RestaurantController, KitchenController],
  providers: [RestaurantService, KitchenService],
})
export class RestaurantModule {}

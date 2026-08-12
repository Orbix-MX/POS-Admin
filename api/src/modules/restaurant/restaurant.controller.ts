import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RestaurantService } from './restaurant.service';
import { CreateComandaDto } from './dto/create-comanda.dto';
import { AddItemsToComandaDto } from './dto/add-items-to-comanda.dto';
import { CheckoutComandaDto } from './dto/checkout-comanda.dto';
import { DirectCheckoutDto } from './dto/direct-checkout.dto';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('Restaurant')
@ApiBearerAuth()
@Controller('restaurant')
export class RestaurantController {
  constructor(private readonly restaurantService: RestaurantService) {}

  @Post('comandas')
  @RequirePermissions('comanda:view|orders:create')
  @ApiOperation({ summary: 'Crear comanda de mesa (sin sesión de caja requerida)' })
  createComanda(@Body() dto: CreateComandaDto) {
    return this.restaurantService.createComanda(dto);
  }

  @Get('open-tables')
  @RequirePermissions('comanda:view|orders:view')
  @ApiOperation({ summary: 'Listar mesas abiertas (comandas pendientes)' })
  getOpenTables() {
    return this.restaurantService.getOpenTables();
  }

  @Post('orders/:id/items')
  @RequirePermissions('comanda:view|orders:create')
  @HttpCode(200)
  @ApiOperation({ summary: 'Agregar ítems a una comanda existente' })
  addItems(@Param('id') id: string, @Body() dto: AddItemsToComandaDto) {
    return this.restaurantService.addItemsToComanda(id, dto);
  }

  @Post('orders/:id/checkout')
  @RequirePermissions('orders:create')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cobrar una mesa (requiere sesión de caja activa)' })
  checkoutComanda(@Param('id') id: string, @Body() dto: CheckoutComandaDto) {
    return this.restaurantService.checkoutComanda(id, dto);
  }

  @Post('checkout/direct')
  @RequirePermissions('orders:create')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cobro directo sin comanda previa (crea y cobra en una sola operación)' })
  checkoutDirect(@Body() dto: DirectCheckoutDto) {
    return this.restaurantService.directCheckout(dto);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DiningOrdersService } from './dining-orders.service';
import { OpenDiningOrderDto, AddDiningItemDto, UpdateDiningItemDto, ChangeDiningStatusDto, CleanupEmptyOrdersDto } from './dto/dining-order.dto';
import { CheckoutDiningOrderDto } from './dto/checkout-dining-order.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@ApiTags('Dining Orders')
@ApiBearerAuth()
@RequireModule('comanda')
@Controller('branches/:branchId/dining-orders')
export class DiningOrdersController {
  constructor(private readonly service: DiningOrdersService) {}

  @Get()
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'List active (OPEN) dining orders for a branch' })
  findActive(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.service.findActive(branchId);
  }

  @Get('table/:tableId')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Get active order for a specific table (null if none)' })
  findForTable(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('tableId', ParseUUIDPipe) tableId: string,
  ) {
    return this.service.findForTable(branchId, tableId);
  }

  @Post()
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Open a dining order for a table (sets table to OCCUPIED)' })
  open(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: OpenDiningOrderDto,
  ) {
    return this.service.open(branchId, dto);
  }

  @Post('cleanup-empty')
  @RequirePermissions('comanda:manage')
  @ApiOperation({ summary: 'Purge abandoned empty OPEN orders (admin / future cron)' })
  cleanupEmpty(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CleanupEmptyOrdersDto,
  ) {
    return this.service.cleanupEmptyOrders(branchId, dto.olderThanMinutes);
  }

  @Get(':orderId')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Get a single dining order with its items' })
  findOne(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.service.findOne(branchId, orderId);
  }

  @Post(':orderId/items')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Add an item to an open dining order' })
  addItem(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AddDiningItemDto,
  ) {
    return this.service.addItem(branchId, orderId, dto);
  }

  @Patch(':orderId/items/:itemId')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Update quantity of a dining order item' })
  updateItem(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateDiningItemDto,
  ) {
    return this.service.updateItem(branchId, orderId, itemId, dto);
  }

  @Patch(':orderId/status')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Advance order status (kitchen flow if KITCHEN enabled, else direct-to-payment)' })
  changeStatus(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ChangeDiningStatusDto,
  ) {
    return this.service.changeStatus(branchId, orderId, dto.status);
  }

  @Post(':orderId/fire')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Send pending items (a new round) to kitchen/cashier without duplicating the order' })
  fireRound(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.service.fireRound(branchId, orderId);
  }

  @Post(':orderId/checkout')
  @RequirePermissions('orders:create')
  @ApiOperation({ summary: 'Charge the dining order: generate Order, consume inventory, record payment, release table' })
  checkout(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CheckoutDiningOrderDto,
  ) {
    return this.service.checkout(branchId, orderId, dto);
  }

  @Delete(':orderId')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Discard an empty OPEN order (abandoned capture); releases the table' })
  discard(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.service.discardIfEmpty(branchId, orderId);
  }

  @Delete(':orderId/items/:itemId')
  @RequirePermissions('comanda:view')
  @ApiOperation({ summary: 'Remove an item from an open dining order' })
  removeItem(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.removeItem(branchId, orderId, itemId);
  }
}

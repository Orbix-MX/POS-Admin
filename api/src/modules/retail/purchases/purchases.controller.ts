import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrdersDto } from './dto/query-purchase-orders.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @RequirePermissions('purchases:view')
  @ApiOperation({ summary: 'Get all purchase orders' })
  findAll(@Query() query: QueryPurchaseOrdersDto) {
    return this.purchasesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('purchases:view')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(id);
  }

  @Post()
  @RequirePermissions('purchases:create')
  @ApiOperation({ summary: 'Create a new purchase order' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchasesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('purchases:edit')
  @ApiOperation({ summary: 'Update a purchase order in draft status' })
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    return this.purchasesService.update(id, dto);
  }

  @Post(':id/send')
  @RequirePermissions('purchases:send')
  @ApiOperation({ summary: 'Send (confirm) a purchase order' })
  send(@Param('id') id: string) {
    return this.purchasesService.send(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('purchases:cancel')
  @ApiOperation({ summary: 'Cancel a purchase order' })
  cancel(@Param('id') id: string) {
    return this.purchasesService.cancel(id);
  }

  @Post(':id/receive')
  @RequirePermissions('purchases:receive')
  @ApiOperation({ summary: 'Register merchandise reception for a purchase order' })
  receive(@Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    return this.purchasesService.receive(id, dto);
  }

  @Get(':id/receipts')
  @RequirePermissions('purchases:view')
  @ApiOperation({ summary: 'Get all receipts for a purchase order' })
  getReceipts(@Param('id') id: string) {
    return this.purchasesService.getReceipts(id);
  }
}

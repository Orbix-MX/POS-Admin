import { Controller, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreOrdersService } from './store-orders.service';
import { UpdateStoreOrderStatusDto, QueryStoreOrdersDto } from './dto/store-order.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { TenantContextService } from '../../../common/context/tenant-context.service';

@ApiTags('Store Orders')
@ApiBearerAuth()
@Controller('store-orders')
export class StoreOrdersController {
  constructor(
    private readonly storeOrdersService: StoreOrdersService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get()
  @RequirePermissions('store-orders:view')
  @ApiOperation({ summary: 'List WhatsApp storefront orders for the current tenant' })
  list(@Query() query: QueryStoreOrdersDto) {
    return this.storeOrdersService.list(this.tenantContext.requireTenantId(), query);
  }

  @Get(':id')
  @RequirePermissions('store-orders:view')
  @ApiOperation({ summary: 'Get a single WhatsApp storefront order with its items' })
  getOne(@Param('id') id: string) {
    return this.storeOrdersService.getOne(this.tenantContext.requireTenantId(), id);
  }

  @Patch(':id/status')
  @RequirePermissions('store-orders:edit')
  @ApiOperation({ summary: 'Advance the order status (confirm / deliver / cancel)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStoreOrderStatusDto) {
    return this.storeOrdersService.updateStatus(this.tenantContext.requireTenantId(), id, dto);
  }
}

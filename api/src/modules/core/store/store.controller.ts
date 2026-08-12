import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AllowInvalidLicense } from '../../../common/decorators/allow-invalid-license.decorator';
import { ResolvedTenant } from '../../../common/decorators/resolved-tenant.decorator';
import { StoreDomainGuard } from '../../../common/guards/store-domain.guard';
import { StoreService } from './store.service';
import { QueryStoreProductsDto } from './dto/query-store-products.dto';
import { StoreOrdersService } from '../store-orders/store-orders.service';
import { CreateStoreOrderDto } from '../store-orders/dto/store-order.dto';

// Unauthenticated storefront read API. The tenant is never supplied by the
// client — StoreDomainGuard resolves it from the request's Origin (the
// e-commerce site's own domain) via the `Domain` table, so the same
// e-commerce build works unmodified for any number of tenants/domains.
@Public()
@AllowInvalidLicense()
@UseGuards(StoreDomainGuard)
@ApiTags('Store (public)')
@Controller('store')
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly storeOrdersService: StoreOrdersService,
  ) {}

  @Get('branding')
  @ApiOperation({ summary: 'Get public branding (name, logo, colors) for a tenant storefront' })
  getBranding(@ResolvedTenant() tenantId: string) {
    return this.storeService.getBranding(tenantId);
  }

  @Get('site')
  @ApiOperation({ summary: "Get the tenant's home page composition (active sections, in order)" })
  getSite(@ResolvedTenant() tenantId: string) {
    return this.storeService.getSite(tenantId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List active categories for a tenant storefront' })
  getCategories(@ResolvedTenant() tenantId: string) {
    return this.storeService.getCategories(tenantId);
  }

  @Get('products')
  @ApiOperation({ summary: 'List active, sellable products for a tenant storefront' })
  getProducts(@ResolvedTenant() tenantId: string, @Query() query: QueryStoreProductsDto) {
    return this.storeService.getProducts(tenantId, query);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Register a cart sent via WhatsApp (no online payment yet)' })
  createOrder(@ResolvedTenant() tenantId: string, @Body() dto: CreateStoreOrderDto) {
    return this.storeOrdersService.createOrder(tenantId, dto);
  }
}

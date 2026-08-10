import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AllowInvalidLicense } from '../../../common/decorators/allow-invalid-license.decorator';
import { ResolvedTenant } from '../../../common/decorators/resolved-tenant.decorator';
import { StoreDomainGuard } from '../../../common/guards/store-domain.guard';
import { StoreService } from './store.service';
import { QueryStoreProductsDto } from './dto/query-store-products.dto';

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
  constructor(private readonly storeService: StoreService) {}

  @Get('branding')
  @ApiOperation({ summary: 'Get public branding (name, logo, colors) for a tenant storefront' })
  getBranding(@ResolvedTenant() tenantId: string) {
    return this.storeService.getBranding(tenantId);
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
}

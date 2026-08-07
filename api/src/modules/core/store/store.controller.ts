import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { AllowInvalidLicense } from '../../../common/decorators/allow-invalid-license.decorator';
import { StoreService } from './store.service';
import { QueryStoreProductsDto } from './dto/query-store-products.dto';

// Unauthenticated storefront read API. tenantId is a public identifier here
// (not taken from a JWT, there is none) — StoreService re-validates it exists
// and is orderable on every call.
@Public()
@AllowInvalidLicense()
@ApiTags('Store (public)')
@Controller('store/:tenantId')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get('categories')
  @ApiOperation({ summary: 'List active categories for a tenant storefront' })
  getCategories(@Param('tenantId') tenantId: string) {
    return this.storeService.getCategories(tenantId);
  }

  @Get('products')
  @ApiOperation({ summary: 'List active, sellable products for a tenant storefront' })
  getProducts(@Param('tenantId') tenantId: string, @Query() query: QueryStoreProductsDto) {
    return this.storeService.getProducts(tenantId, query);
  }
}

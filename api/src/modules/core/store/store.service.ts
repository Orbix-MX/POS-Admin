import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { QueryStoreProductsDto } from './dto/query-store-products.dto';

// Public storefront projection — deliberately excludes cost/audit fields
// (costPrice, lastCost, avgCost, taxCode, createdById, ...) that live on the
// same Product model but must never reach an unauthenticated client.
const STORE_PRODUCT_SELECT = {
  id: true,
  sku: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  comparePrice: true,
  stock: true,
  trackInventory: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: { id: true, url: true, altText: true, isPrimary: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  attributeValues: {
    select: {
      value: true,
      attribute: { select: { id: true, name: true, slug: true, type: true } },
    },
  },
} satisfies Prisma.ProductSelect;

const ORDERABLE_TENANT_STATUSES = ['ACTIVE', 'TRIAL'];

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  private async assertStorefrontTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });

    if (!tenant || !ORDERABLE_TENANT_STATUSES.includes(tenant.status)) {
      throw new NotFoundException('Tienda no encontrada');
    }
  }

  async getCategories(tenantId: string) {
    await this.assertStorefrontTenant(tenantId);

    return this.prisma.category.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getProducts(tenantId: string, query: QueryStoreProductsDto) {
    await this.assertStorefrontTenant(tenantId);

    const where: Prisma.ProductWhereInput = {
      tenantId,
      status: 'ACTIVE',
      type: 'SIMPLE',
      isEcommerce: true,
    };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.categorySlug) {
      where.category = { slug: query.categorySlug };
    }

    return this.prisma.product.findMany({
      where,
      select: STORE_PRODUCT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }
}

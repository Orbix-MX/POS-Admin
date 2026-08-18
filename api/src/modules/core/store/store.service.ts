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
  // `cost` is deliberately excluded — internal margin data, never public.
  attributes: { select: { id: true, name: true, price: true } },
  features: { select: { feature: true, value: true } },
} satisfies Prisma.ProductSelect;

// Tenant existence + orderable status are already enforced by StoreDomainGuard
// (it only resolves a tenantId once the Domain lookup confirms both), so these
// queries trust the tenantId they're given.

@Injectable()
export class StoreService {
  constructor(private prisma: PrismaService) {}

  async getBranding(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, settings: true },
    });
    if (!tenant) throw new NotFoundException('Tienda no encontrada');

    const s = (tenant.settings as Record<string, unknown>) ?? {};
    return {
      name: (s['displayName'] as string) || tenant.name,
      logoUrl: s['logoUrl'] as string | undefined,
      bannerUrl: s['bannerUrl'] as string | undefined,
      primaryColor: s['primaryColor'] as string | undefined,
      secondaryColor: s['secondaryColor'] as string | undefined,
    };
  }

  /**
   * Composición de la home del tenant (secciones activas, en orden). Un
   * tenant sin `TenantSite` (feature "tienda-online" no habilitada, o
   * plantilla no asignada todavía) simplemente no tiene secciones — el
   * frontend cae de vuelta a su home estática por defecto.
   */
  async getSite(tenantId: string) {
    const site = await this.prisma.tenantSite.findUnique({
      where: { tenantId },
      select: {
        siteSections: {
          where: { isActive: true },
          select: { sectionType: true, content: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return {
      sections: (site?.siteSections ?? []).map((s) => ({ type: s.sectionType, content: s.content })),
    };
  }

  async getCategories(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        images: { where: { isPrimary: true }, select: { url: true }, take: 1 },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return categories.map(({ images, ...rest }) => ({ ...rest, imageUrl: images[0]?.url }));
  }

  async getProducts(tenantId: string, query: QueryStoreProductsDto) {
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

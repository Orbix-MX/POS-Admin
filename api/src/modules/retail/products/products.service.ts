import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { BusinessConfigurationService } from '../../../common/business-config/business-configuration.service';
import { R2Service } from '../../../storage/r2.service';
import { SlugUtil } from '../../../common/utils/slug.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Product, Prisma } from '@prisma/client';

const MAX_IMAGE_WIDTH = 1200;

const PRODUCT_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  recipe: {
    include: {
      items: {
        include: {
          supply: { include: { inventoryUnit: true, baseUnit: true } },
        },
      },
    },
  },
  comboItems: { include: { child: true } },
  _count: { select: { orderItems: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private audit: AuditService,
    private r2: R2Service,
    // BR-02: recipes are a Restaurant-only capability. Availability is decided
    // exclusively through the business configuration facade — the service never
    // reads BusinessProfile. Combos and SIMPLE/SERVICE products are unaffected.
    private businessConfig: BusinessConfigurationService,
  ) {}

  /**
   * BR-02: gate recipe capabilities behind the `enableRecipes` feature. Throws
   * when the tenant's business configuration does not support recipes (e.g.
   * RETAIL). Restaurant (feature on) is unaffected. Only recipe entry points
   * call this — no sale/inventory/combo flow goes through here.
   */
  private async assertRecipesEnabled(): Promise<void> {
    if (!(await this.businessConfig.hasFeature('enableRecipes'))) {
      throw new ForbiddenException(
        'Las recetas no están disponibles para este tipo de negocio',
      );
    }
  }

  private async resolveNormalizedQty(
    db: any,
    item: { supplyId: string; quantity: number; unitId?: string | null },
  ): Promise<number | null> {
    if (!item.unitId) return null;

    const supply = await db.supply.findUnique({
      where: { id: item.supplyId },
      select: { inventoryUnitId: true, baseUnitId: true, conversionFactor: true },
    });

    if (!supply) return null;

    const convFactor = Number(supply.conversionFactor ?? 1) || 1;

    if (item.unitId === supply.inventoryUnitId) {
      return item.quantity * convFactor;
    }
    if (item.unitId === supply.baseUnitId) {
      return item.quantity;
    }

    // Legacy: supplyAllowedUnit lookup
    const [allowed, unit] = await Promise.all([
      db.supplyAllowedUnit.findUnique({
        where: { supplyId_unitId: { supplyId: item.supplyId, unitId: item.unitId } },
      }),
      db.measurementUnit.findUnique({ where: { id: item.unitId } }),
    ]);
    const factor = allowed ? Number(allowed.conversionFactor) : (unit ? Number(unit.baseFactor) : 1);
    return item.quantity * factor;
  }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const { recipeItems, comboItems, ...productData } = createProductDto;

    const existingProduct = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: productData.sku } },
    });

    if (existingProduct) {
      throw new ConflictException('SKU already exists');
    }

    if (productData.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: productData.categoryId, tenantId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const existingSlugs = await this.prisma.product.findMany({
      where: { tenantId },
      select: { slug: true },
    });

    const slug = SlugUtil.generateUnique(
      productData.name,
      existingSlugs.map((p) => p.slug),
    );

    // RECIPE/COMBO/SERVICE don't track product stock
    const type = productData.type ?? 'SIMPLE';
    // BR-02: only RECIPE products require the recipes capability. COMBO and
    // SERVICE remain available on every vertical (combos stay independent).
    if (type === 'RECIPE') await this.assertRecipesEnabled();
    if (type !== 'SIMPLE') {
      productData.trackInventory = false;
      productData.stock = 0;
    }

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...productData, type, tenantId, slug },
        include: PRODUCT_INCLUDE,
      });

      if (type === 'RECIPE' && recipeItems?.length) {
        const normalizedItems = await Promise.all(
          recipeItems.map(async (i) => ({
            supplyId: i.supplyId,
            quantity: i.quantity,
            unit: i.unit,
            unitId: i.unitId ?? null,
            normalizedQuantity: await this.resolveNormalizedQty(tx, i),
          })),
        );
        await tx.recipe.create({
          data: {
            productId: created.id,
            items: { create: normalizedItems },
          },
        });
        return tx.product.findUnique({ where: { id: created.id }, include: PRODUCT_INCLUDE }) as Promise<Product>;
      }

      if (type === 'COMBO' && comboItems?.length) {
        await tx.comboItem.createMany({
          data: comboItems.map((ci) => ({
            comboProductId: created.id,
            childProductId: ci.childProductId,
            quantity: ci.quantity ?? 1,
          })),
        });
        return tx.product.findUnique({ where: { id: created.id }, include: PRODUCT_INCLUDE }) as Promise<Product>;
      }

      return created;
    });

    return product;
  }

  async findAll(queryDto: QueryProductDto): Promise<PaginatedResponse<Product>> {
    const { skip, limit, page, search, categoryId, status, type } = queryDto;
    const tenantId = this.tenantContext.requireTenantId();
    const where: Prisma.ProductWhereInput = { tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (type) where.type = type;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: PRODUCT_INCLUDE,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: PRODUCT_INCLUDE,
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });

    if (!product) throw new NotFoundException('Product not found');

    const { recipeItems, comboItems, ...productData } = updateProductDto;

    if (productData.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: productData.categoryId },
      });

      if (!category) throw new NotFoundException('Category not found');
    }

    let slug = product.slug;
    if (productData.name && productData.name !== product.name) {
      const existingSlugs = await this.prisma.product.findMany({
        where: { tenantId, id: { not: id } },
        select: { slug: true },
      });

      slug = SlugUtil.generateUnique(
        productData.name,
        existingSlugs.map((p) => p.slug),
      );
    }

    const newType = productData.type ?? product.type;
    if (newType !== 'SIMPLE') {
      productData.trackInventory = false;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data: { ...productData, slug },
        include: PRODUCT_INCLUDE,
      });

      // Sync recipe items
      if (newType === 'RECIPE' && recipeItems !== undefined) {
        const existingRecipe = await tx.recipe.findUnique({ where: { productId: id } });
        if (existingRecipe) {
          await tx.recipeItem.deleteMany({ where: { recipeId: existingRecipe.id } });
          if (recipeItems.length > 0) {
            const normalizedItems = await Promise.all(
              recipeItems.map(async (i) => ({
                recipeId: existingRecipe.id,
                supplyId: i.supplyId,
                quantity: i.quantity,
                unit: i.unit,
                unitId: i.unitId ?? null,
                normalizedQuantity: await this.resolveNormalizedQty(tx, i),
              })),
            );
            await tx.recipeItem.createMany({ data: normalizedItems });
          }
        } else if (recipeItems.length > 0) {
          const normalizedItems = await Promise.all(
            recipeItems.map(async (i) => ({
              supplyId: i.supplyId,
              quantity: i.quantity,
              unit: i.unit,
              unitId: i.unitId ?? null,
              normalizedQuantity: await this.resolveNormalizedQty(tx, i),
            })),
          );
          await tx.recipe.create({
            data: {
              productId: id,
              items: { create: normalizedItems },
            },
          });
        }
      }

      // Sync combo items
      if (newType === 'COMBO' && comboItems !== undefined) {
        await tx.comboItem.deleteMany({ where: { comboProductId: id } });
        if (comboItems.length > 0) {
          await tx.comboItem.createMany({
            data: comboItems.map((ci) => ({
              comboProductId: id,
              childProductId: ci.childProductId,
              quantity: ci.quantity ?? 1,
            })),
          });
        }
      }

      return tx.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE }) as Promise<Product>;
    });

    if (
      productData.price != null &&
      Number(productData.price) !== Number(product.price)
    ) {
      await this.audit.log({
        action: 'PRICE_CHANGE',
        entityType: 'Product',
        entityId: id,
        before: { price: Number(product.price) },
        after: { price: Number(productData.price) },
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: { orderItems: true, images: true },
    });

    if (!product) throw new NotFoundException('Product not found');

    if (product.orderItems.length > 0) {
      throw new BadRequestException('Cannot delete product with existing orders');
    }

    await Promise.all(
      product.images.flatMap((img) =>
        img.key ? [this.r2.delete(img.key)] : [],
      ),
    );

    await this.prisma.product.delete({ where: { id } });
  }

  async uploadImage(productId: string, file: Express.Multer.File) {
    const tenantId = this.tenantContext.requireTenantId();

    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
      include: { images: { where: { isPrimary: true } } },
    });

    if (!product) throw new NotFoundException('Product not found');

    const webpBuffer = await sharp(file.buffer)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const imageId = randomUUID();
    const key = this.r2.buildKey(tenantId, productId, imageId);
    const url = await this.r2.upload(key, webpBuffer, 'image/webp');

    const oldPrimary = product.images?.[0];

    return this.prisma.$transaction(async (tx) => {
      if (oldPrimary) {
        await tx.productImage.delete({ where: { id: oldPrimary.id } });
      }

      const image = await tx.productImage.create({
        data: {
          id: imageId,
          productId,
          url,
          key,
          mimeType: 'image/webp',
          size: webpBuffer.length,
          isPrimary: true,
          sortOrder: 0,
        },
      });

      if (oldPrimary?.key) {
        await this.r2.delete(oldPrimary.key);
      }

      return image;
    });
  }

  async removeImage(productId: string, imageId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { tenantId } },
    });

    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.key) {
      await this.r2.delete(image.key);
    }
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({ where: { id, tenantId } });

    if (!product) throw new NotFoundException('Product not found');

    if (product.type !== 'SIMPLE') {
      throw new BadRequestException('Solo productos SIMPLE manejan stock directo');
    }

    if (!product.trackInventory) {
      throw new BadRequestException('Product does not track inventory');
    }

    const newStock = product.stock + quantity;

    if (newStock < 0) throw new BadRequestException('Insufficient stock');

    // Flujo de ajuste oficial: la baja/alta de stock y su movimiento AJUSTE van
    // juntos en una transacción. Antes era una escritura "manual" sin ledger.
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.product.update({
        where: { id, tenantId },
        data: { stock: newStock },
      });
      if (quantity !== 0) {
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            type: 'AJUSTE',
            productId: id,
            quantity,
            referenceId: id,
            referenceType: 'PRODUCT_ADJUST',
            notes: `Ajuste manual (${quantity >= 0 ? '+' : ''}${quantity})`,
          },
        });
      }
      return u;
    });

    await this.audit.log({
      action: 'INVENTORY_ADJUST',
      entityType: 'Product',
      entityId: id,
      before: { stock: product.stock },
      after: { stock: updated.stock },
      reason: `Ajuste manual (${quantity >= 0 ? '+' : ''}${quantity})`,
    });

    return updated;
  }

  async getLowStock(limit = 10) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.product.findMany({
      where: {
        tenantId,
        type: 'SIMPLE',
        trackInventory: true,
        stock: {
          lte: this.prisma.product.fields.lowStockAlert,
        },
        status: 'ACTIVE',
      },
      take: limit,
      include: { category: true },
      orderBy: { stock: 'asc' },
    });
  }

  async getRecipe(productId: string) {
    await this.assertRecipesEnabled();
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'RECIPE' },
    });
    if (!product) throw new NotFoundException('Producto tipo RECIPE no encontrado');

    return this.prisma.recipe.findUnique({
      where: { productId },
      include: { items: { include: { supply: true } } },
    });
  }

  async upsertRecipe(
    productId: string,
    items: Array<{ supplyId: string; quantity: number; unit: string; unitId?: string }>,
    notes?: string,
  ) {
    await this.assertRecipesEnabled();
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'RECIPE' },
    });
    if (!product) throw new NotFoundException('Producto tipo RECIPE no encontrado');

    const normalizedItems = await Promise.all(
      items.map(async (i) => ({
        supplyId: i.supplyId,
        quantity: i.quantity,
        unit: i.unit,
        unitId: i.unitId ?? null,
        normalizedQuantity: await this.resolveNormalizedQty(this.prisma, i),
      })),
    );

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({ where: { productId } });
      if (existing) {
        await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
        await tx.recipe.update({
          where: { id: existing.id },
          data: {
            notes: notes ?? existing.notes,
            items: { create: normalizedItems },
          },
        });
      } else {
        await tx.recipe.create({
          data: { productId, notes, items: { create: normalizedItems } },
        });
      }

      return tx.recipe.findUnique({
        where: { productId },
        include: { items: { include: { supply: true, measurementUnit: true } } },
      });
    });
  }

  async getComboItems(productId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'COMBO' },
    });
    if (!product) throw new NotFoundException('Producto tipo COMBO no encontrado');

    return this.prisma.comboItem.findMany({
      where: { comboProductId: productId },
      include: { child: { include: { images: true } } },
    });
  }

  async upsertComboItems(productId: string, items: Array<{ childProductId: string; quantity: number }>) {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'COMBO' },
    });
    if (!product) throw new NotFoundException('Producto tipo COMBO no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await tx.comboItem.deleteMany({ where: { comboProductId: productId } });
      if (items.length > 0) {
        await tx.comboItem.createMany({
          data: items.map((i) => ({
            comboProductId: productId,
            childProductId: i.childProductId,
            quantity: i.quantity,
          })),
        });
      }
      return tx.comboItem.findMany({
        where: { comboProductId: productId },
        include: { child: { include: { images: true } } },
      });
    });
  }
}

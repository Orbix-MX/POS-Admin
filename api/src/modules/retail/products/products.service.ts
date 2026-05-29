import { randomUUID } from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import sharp from 'sharp';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditService } from '../../../common/services/audit.service';
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
  recipe: { include: { items: { include: { supply: true } } } },
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
  ) {}

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
        const recipe = await tx.recipe.create({
          data: {
            productId: created.id,
            items: {
              create: recipeItems.map((i) => ({
                supplyId: i.supplyId,
                quantity: i.quantity,
                unit: i.unit,
              })),
            },
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

    return product as Product;
  }

  async findAll(queryDto: QueryProductDto): Promise<PaginatedResponse<Product>> {
    const { skip, limit, page, search, categoryId, status } = queryDto;
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
    const tenantId = this.tenantContext.getTenantId();
    const where = tenantId ? { id, tenantId } : { id };
    const product = await this.prisma.product.findFirst({
      where,
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
            await tx.recipeItem.createMany({
              data: recipeItems.map((i) => ({
                recipeId: existingRecipe.id,
                supplyId: i.supplyId,
                quantity: i.quantity,
                unit: i.unit,
              })),
            });
          }
        } else if (recipeItems.length > 0) {
          await tx.recipe.create({
            data: {
              productId: id,
              items: {
                create: recipeItems.map((i) => ({
                  supplyId: i.supplyId,
                  quantity: i.quantity,
                  unit: i.unit,
                })),
              },
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

    return updated as Product;
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
    console.log('file', file);

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

    console.log('[removeImage] productId=%s imageId=%s tenantId=%s', productId, imageId, tenantId);

    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { tenantId } },
    });

    console.log('[removeImage] found=%s', !!image);

    if (!image) throw new NotFoundException('Image not found');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.key) {
      await this.r2.delete(image.key);
    }
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product) throw new NotFoundException('Product not found');

    if (product.type !== 'SIMPLE') {
      throw new BadRequestException('Solo productos SIMPLE manejan stock directo');
    }

    if (!product.trackInventory) {
      throw new BadRequestException('Product does not track inventory');
    }

    const newStock = product.stock + quantity;

    if (newStock < 0) throw new BadRequestException('Insufficient stock');

    const updated = await this.prisma.product.update({
      where: { id },
      data: { stock: newStock },
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
    return this.prisma.product.findMany({
      where: {
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

  async upsertRecipe(productId: string, items: Array<{ supplyId: string; quantity: number; unit: string }>, notes?: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, type: 'RECIPE' },
    });
    if (!product) throw new NotFoundException('Producto tipo RECIPE no encontrado');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.recipe.findUnique({ where: { productId } });
      if (existing) {
        await tx.recipeItem.deleteMany({ where: { recipeId: existing.id } });
        await tx.recipe.update({
          where: { id: existing.id },
          data: {
            notes: notes ?? existing.notes,
            items: {
              create: items.map((i) => ({ supplyId: i.supplyId, quantity: i.quantity, unit: i.unit })),
            },
          },
        });
      } else {
        await tx.recipe.create({
          data: {
            productId,
            notes,
            items: {
              create: items.map((i) => ({ supplyId: i.supplyId, quantity: i.quantity, unit: i.unit })),
            },
          },
        });
      }

      return tx.recipe.findUnique({
        where: { productId },
        include: { items: { include: { supply: true } } },
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

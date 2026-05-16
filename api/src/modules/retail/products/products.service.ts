import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { SlugUtil } from '../../../common/utils/slug.util';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { AddImageDto } from './dto/add-image.dto';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Product, Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private audit: AuditService,
  ) { }

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();

    const existingProduct = await this.prisma.product.findUnique({
      where: { tenantId_sku: { tenantId, sku: createProductDto.sku } },
    });

    if (existingProduct) {
      throw new ConflictException('SKU already exists');
    }

    if (createProductDto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: createProductDto.categoryId, tenantId },
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
      createProductDto.name,
      existingSlugs.map((p) => p.slug),
    );

    return this.prisma.product.create({
      data: {
        ...createProductDto,
        tenantId,
        slug,
      },
      include: {
        category: true,
        images: true,
      },
    });
  }

  async findAll(
    queryDto: QueryProductDto,
  ): Promise<PaginatedResponse<Product>> {
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

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          images: {
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: { orderItems: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: products,
      meta: {
        page: page,
        limit: limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Product> {
    const tenantId = this.tenantContext.requireTenantId();
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { orderItems: true } },
      },
    });

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (updateProductDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    let slug = product.slug;
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      const existingSlugs = await this.prisma.product.findMany({
        where: { id: { not: id } },
        select: { slug: true },
      });

      slug = SlugUtil.generateUnique(
        updateProductDto.name,
        existingSlugs.map((p) => p.slug),
      );
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...updateProductDto,
        slug,
      },
      include: {
        category: true,
        images: true,
      },
    });

    // Audit price changes (sensitive — affects revenue)
    if (
      updateProductDto.price != null &&
      Number(updateProductDto.price) !== Number(product.price)
    ) {
      await this.audit.log({
        action: 'PRICE_CHANGE',
        entityType: 'Product',
        entityId: id,
        before: { price: Number(product.price) },
        after: { price: Number(updated.price) },
      });
    }

    return updated;
  }

  async remove(id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        orderItems: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.orderItems.length > 0) {
      throw new BadRequestException(
        'Cannot delete product with existing orders',
      );
    }

    await this.prisma.product.delete({
      where: { id },
    });
  }

  async addImage(productId: string, addImageDto: AddImageDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (addImageDto.isPrimary) {
      await this.prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.productImage.create({
      data: {
        productId,
        ...addImageDto,
      },
    });
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.productImage.delete({
      where: { id: imageId },
    });
  }

  async updateStock(id: string, quantity: number): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.trackInventory) {
      throw new BadRequestException('Product does not track inventory');
    }

    const newStock = product.stock + quantity;

    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock');
    }

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
        trackInventory: true,
        stock: {
          lte: this.prisma.product.fields.lowStockAlert,
        },
        status: 'ACTIVE',
      },
      take: limit,
      include: {
        category: true,
      },
      orderBy: { stock: 'asc' },
    });
  }
}

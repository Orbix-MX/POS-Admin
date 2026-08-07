import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { SlugUtil } from '../../../common/utils/slug.util';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';
import { ProductAttribute } from '@prisma/client';

@Injectable()
export class ProductAttributesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateProductAttributeDto): Promise<ProductAttribute> {
    const tenantId = this.tenantContext.requireTenantId();

    const existingSlugs = await this.prisma.productAttribute.findMany({
      where: { tenantId },
      select: { slug: true },
    });

    const slug =
      dto.slug && !existingSlugs.some((a) => a.slug === dto.slug)
        ? dto.slug
        : SlugUtil.generateUnique(dto.name, existingSlugs.map((a) => a.slug));

    return this.prisma.productAttribute.create({
      data: {
        tenantId,
        name: dto.name,
        slug,
        type: dto.type ?? 'TEXT',
        options: dto.options ?? [],
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(): Promise<ProductAttribute[]> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.productAttribute.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string): Promise<ProductAttribute> {
    const tenantId = this.tenantContext.requireTenantId();
    const attribute = await this.prisma.productAttribute.findFirst({ where: { id, tenantId } });
    if (!attribute) throw new NotFoundException('Attribute not found');
    return attribute;
  }

  async update(id: string, dto: UpdateProductAttributeDto): Promise<ProductAttribute> {
    const tenantId = this.tenantContext.requireTenantId();
    const attribute = await this.prisma.productAttribute.findFirst({ where: { id, tenantId } });
    if (!attribute) throw new NotFoundException('Attribute not found');

    let slug = attribute.slug;
    if (dto.slug !== undefined || (dto.name && dto.name !== attribute.name)) {
      const existingSlugs = await this.prisma.productAttribute.findMany({
        where: { tenantId, id: { not: id } },
        select: { slug: true },
      });
      const candidate = dto.slug ?? dto.name ?? attribute.name;
      slug = !existingSlugs.some((a) => a.slug === candidate)
        ? candidate
        : SlugUtil.generateUnique(dto.name ?? attribute.name, existingSlugs.map((a) => a.slug));
    }

    const { name, type, options, sortOrder, isActive } = dto;
    return this.prisma.productAttribute.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(type !== undefined && { type }),
        ...(options !== undefined && { options }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        slug,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const attribute = await this.prisma.productAttribute.findFirst({
      where: { id, tenantId },
      include: { values: true },
    });
    if (!attribute) throw new NotFoundException('Attribute not found');
    if (attribute.values.length > 0) {
      throw new BadRequestException('Cannot delete an attribute already assigned to products');
    }

    await this.prisma.productAttribute.delete({ where: { id } });
  }
}

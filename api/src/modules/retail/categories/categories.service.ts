import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { SlugUtil } from '../../../common/utils/slug.util';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from '@prisma/client';

export interface CategoryWithChildren extends Category {
  children?: CategoryWithChildren[];
}

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const tenantId = this.tenantContext.requireTenantId();

    if (createCategoryDto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: createCategoryDto.parentId, tenantId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    const existingSlugs = await this.prisma.category.findMany({
      where: { tenantId },
      select: { slug: true },
    });

    const slug =
      createCategoryDto.slug &&
      !existingSlugs.some((c) => c.slug === createCategoryDto.slug)
        ? createCategoryDto.slug
        : SlugUtil.generateUnique(
            createCategoryDto.name,
            existingSlugs.map((c) => c.slug),
          );

    return this.prisma.category.create({
      data: {
        tenantId,
        name: createCategoryDto.name,
        slug,
        description: createCategoryDto.description,
        parentId: createCategoryDto.parentId,
        status: createCategoryDto.status ?? 'ACTIVE',
        sortOrder: createCategoryDto.sortOrder ?? 0,
      },
    });
  }

  async findAll(): Promise<Category[]> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: true,
        _count: {
          select: { products: true, children: true },
        },
      },
    });
  }

  async findTree(): Promise<CategoryWithChildren[]> {
    const tenantId = this.tenantContext.requireTenantId();
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const buildTree = (parentId: string | null): CategoryWithChildren[] => {
      return categories
        .filter((cat) => cat.parentId === parentId)
        .map((cat) => ({
          ...cat,
          children: buildTree(cat.id),
        }));
    };

    return buildTree(null);
  }

  async findOne(id: string): Promise<Category> {
    const tenantId = this.tenantContext.requireTenantId();
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: {
        parent: true,
        children: true,
        _count: { select: { products: true } },
      },
    });

    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto): Promise<Category> {
    const tenantId = this.tenantContext.requireTenantId();
    const category = await this.prisma.category.findFirst({ where: { id, tenantId } });
    if (!category) throw new NotFoundException('Category not found');

    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      const parent = await this.prisma.category.findFirst({
        where: { id: updateCategoryDto.parentId, tenantId },
      });
      if (!parent) throw new NotFoundException('Parent category not found');
    }

    let slug = category.slug;
    if (updateCategoryDto.slug !== undefined) {
      const existingSlugs = await this.prisma.category.findMany({
        where: { tenantId, id: { not: id } },
        select: { slug: true },
      });
      slug = !existingSlugs.some((c) => c.slug === updateCategoryDto.slug)
        ? updateCategoryDto.slug
        : SlugUtil.generateUnique(
            updateCategoryDto.name ?? category.name,
            existingSlugs.map((c) => c.slug),
          );
    } else if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const existingSlugs = await this.prisma.category.findMany({
        where: { tenantId, id: { not: id } },
        select: { slug: true },
      });
      slug = SlugUtil.generateUnique(
        updateCategoryDto.name,
        existingSlugs.map((c) => c.slug),
      );
    }

    const { name, description, parentId, status, sortOrder } = updateCategoryDto;
    return this.prisma.category.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parentId }),
        ...(status !== undefined && { status }),
        ...(sortOrder !== undefined && { sortOrder }),
        slug,
      },
    });
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const category = await this.prisma.category.findFirst({
      where: { id, tenantId },
      include: { children: true, products: true },
    });

    if (!category) throw new NotFoundException('Category not found');
    if (category.children.length > 0) throw new BadRequestException('Cannot delete category with subcategories');
    if (category.products.length > 0) throw new BadRequestException('Cannot delete category with products');

    await this.prisma.category.delete({ where: { id } });
  }
}

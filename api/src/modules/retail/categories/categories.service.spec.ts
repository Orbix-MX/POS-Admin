import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../../../database/prisma.service';
import { SlugUtil } from '../../../common/utils/slug.util';
import { TenantContextService } from '../../../common/context/tenant-context.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    category: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TenantContextService, useValue: { requireTenantId: () => 'tenant-1', getBranchId: () => null } },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category', async () => {
      const createCategoryDto = {
        name: 'Test Category',
        description: 'Test description',
      };

      const mockCategory = {
        id: '1',
        name: createCategoryDto.name,
        slug: 'test-category',
        description: createCategoryDto.description,
        parentId: null,
        status: 'ACTIVE' as const,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.category.findMany.mockResolvedValue([]);
      mockPrismaService.category.create.mockResolvedValue(mockCategory);
      jest.spyOn(SlugUtil, 'generateUnique').mockReturnValue('test-category');

      const result = await service.create(createCategoryDto);

      expect(result.slug).toBe('test-category');
      expect(result.name).toBe(createCategoryDto.name);
    });

    it('should throw NotFoundException if parent category not found', async () => {
      const createCategoryDto = {
        name: 'Child Category',
        parentId: 'invalid-parent',
      };

      mockPrismaService.category.findUnique.mockResolvedValue(null);
      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.create(createCategoryDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Category 1',
          slug: 'category-1',
          parent: null,
          _count: { products: 5, children: 2 },
        },
        {
          id: '2',
          name: 'Category 2',
          slug: 'category-2',
          parent: null,
          _count: { products: 3, children: 0 },
        },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Category 1');
    });
  });

  describe('findTree', () => {
    it('should return hierarchical category tree', async () => {
      const mockCategories = [
        {
          id: '1',
          name: 'Parent',
          slug: 'parent',
          parentId: null,
          status: 'ACTIVE',
          sortOrder: 0,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Child',
          slug: 'child',
          parentId: '1',
          status: 'ACTIVE',
          sortOrder: 0,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.category.findMany.mockResolvedValue(mockCategories);

      const result = await service.findTree();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Parent');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].name).toBe('Child');
    });
  });

  describe('findOne', () => {
    it('should return a category by id', async () => {
      const categoryId = '1';
      const mockCategory = {
        id: categoryId,
        name: 'Test Category',
        slug: 'test-category',
        parent: null,
        children: [],
        _count: { products: 5 },
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      const result = await service.findOne(categoryId);

      expect(result.id).toBe(categoryId);
      expect(result.name).toBe('Test Category');
    });

    it('should throw NotFoundException if category not found', async () => {
      mockPrismaService.category.findUnique.mockResolvedValue(null);
      mockPrismaService.category.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const categoryId = '1';
      const updateDto = { name: 'Updated Category' };
      const mockCategory = {
        id: categoryId,
        name: 'Test Category',
        slug: 'test-category',
      };

      const updatedCategory = { ...mockCategory, name: 'Updated Category' };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);
      mockPrismaService.category.findMany.mockResolvedValue([]);
      mockPrismaService.category.update.mockResolvedValue(updatedCategory);
      jest
        .spyOn(SlugUtil, 'generateUnique')
        .mockReturnValue('updated-category');

      const result = await service.update(categoryId, updateDto);

      expect(result.name).toBe('Updated Category');
    });

    it('should throw BadRequestException if category is its own parent', async () => {
      const categoryId = '1';
      const updateDto = { parentId: '1' };
      const mockCategory = { id: categoryId };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.update(categoryId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a category', async () => {
      const categoryId = '1';
      const mockCategory = {
        id: categoryId,
        children: [],
        products: [],
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);
      mockPrismaService.category.delete.mockResolvedValue(mockCategory);

      await service.remove(categoryId);

      expect(mockPrismaService.category.delete).toHaveBeenCalledWith({
        where: { id: categoryId },
      });
    });

    it('should throw BadRequestException if category has children', async () => {
      const categoryId = '1';
      const mockCategory = {
        id: categoryId,
        children: [{ id: '2' }],
        products: [],
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.remove(categoryId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if category has products', async () => {
      const categoryId = '1';
      const mockCategory = {
        id: categoryId,
        children: [],
        products: [{ id: '1' }],
      };

      mockPrismaService.category.findUnique.mockResolvedValue(mockCategory);
      mockPrismaService.category.findFirst.mockResolvedValue(mockCategory);

      await expect(service.remove(categoryId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

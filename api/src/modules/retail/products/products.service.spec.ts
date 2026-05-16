import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../../../database/prisma.service';
import { SlugUtil } from '../../../common/utils/slug.util';

describe('ProductsService', () => {
  let service: ProductsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      fields: {
        lowStockAlert: 5,
      },
    },
    category: {
      findUnique: jest.fn(),
    },
    productImage: {
      create: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new product', async () => {
      const createProductDto = {
        sku: 'TEST-001',
        name: 'Test Product',
        description: 'Test description',
        price: 99.99,
        categoryId: 'cat-1',
        status: 'ACTIVE' as const,
      };

      const mockProduct = {
        id: '1',
        ...createProductDto,
        slug: 'test-product',
        comparePrice: null,
        costPrice: null,
        stock: 0,
        trackInventory: true,
        lowStockAlert: 5,
        metaTitle: null,
        metaDescription: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: { id: 'cat-1', name: 'Category' },
        images: [],
      };

      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue({ id: 'cat-1' });
      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.create.mockResolvedValue(mockProduct);
      jest.spyOn(SlugUtil, 'generateUnique').mockReturnValue('test-product');

      const result = await service.create(createProductDto);

      expect(result.sku).toBe(createProductDto.sku);
      expect(result.slug).toBe('test-product');
      expect(mockPrismaService.product.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if SKU exists', async () => {
      const createProductDto = {
        sku: 'EXISTING-SKU',
        name: 'Test Product',
        price: 99.99,
      };

      mockPrismaService.product.findUnique.mockResolvedValue({ id: '1' });

      await expect(service.create(createProductDto as any)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if category not found', async () => {
      const createProductDto = {
        sku: 'TEST-001',
        name: 'Test Product',
        price: 99.99,
        categoryId: 'invalid-cat',
      };

      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.category.findUnique.mockResolvedValue(null);

      await expect(service.create(createProductDto as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const queryDto = { page: 1, limit: 10, skip: 0 };
      const mockProducts = [
        {
          id: '1',
          sku: 'TEST-001',
          name: 'Test Product',
          price: 99.99,
          category: null,
          images: [],
          _count: { orderItems: 0 },
        },
      ];

      mockPrismaService.product.findMany.mockResolvedValue(mockProducts);
      mockPrismaService.product.count.mockResolvedValue(1);

      const result = await service.findAll(queryDto);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter products by search term', async () => {
      const queryDto = { page: 1, limit: 10, skip: 0, search: 'test' };

      mockPrismaService.product.findMany.mockResolvedValue([]);
      mockPrismaService.product.count.mockResolvedValue(0);

      await service.findAll(queryDto);

      expect(mockPrismaService.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a product by id', async () => {
      const productId = '1';
      const mockProduct = {
        id: productId,
        sku: 'TEST-001',
        name: 'Test Product',
        category: null,
        images: [],
        _count: { orderItems: 0 },
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      const result = await service.findOne(productId);

      expect(result.id).toBe(productId);
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a product', async () => {
      const productId = '1';
      const updateDto = { name: 'Updated Product' };
      const mockProduct = {
        id: productId,
        sku: 'TEST-001',
        name: 'Test Product',
        slug: 'test-product',
      };

      const updatedProduct = { ...mockProduct, name: 'Updated Product' };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.update(productId, updateDto);

      expect(result.name).toBe('Updated Product');
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addImage', () => {
    it('should add image to product', async () => {
      const productId = '1';
      const addImageDto = {
        url: 'https://example.com/image.jpg',
        altText: 'Test image',
        isPrimary: false,
      };

      const mockProduct = { id: productId };
      const mockImage = {
        id: '1',
        productId,
        ...addImageDto,
        sortOrder: 0,
        createdAt: new Date(),
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.productImage.create.mockResolvedValue(mockImage);

      const result = await service.addImage(productId, addImageDto);

      expect(result.url).toBe(addImageDto.url);
      expect(mockPrismaService.productImage.create).toHaveBeenCalled();
    });

    it('should update other images when setting primary', async () => {
      const productId = '1';
      const addImageDto = {
        url: 'https://example.com/image.jpg',
        isPrimary: true,
      };

      mockPrismaService.product.findUnique.mockResolvedValue({ id: productId });
      mockPrismaService.productImage.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.productImage.create.mockResolvedValue({
        id: '1',
        productId,
        ...addImageDto,
      });

      await service.addImage(productId, addImageDto);

      expect(mockPrismaService.productImage.updateMany).toHaveBeenCalledWith({
        where: { productId },
        data: { isPrimary: false },
      });
    });
  });

  describe('updateStock', () => {
    it('should update product stock', async () => {
      const productId = '1';
      const quantity = 10;
      const mockProduct = {
        id: productId,
        stock: 5,
        trackInventory: true,
      };

      const updatedProduct = { ...mockProduct, stock: 15 };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.product.update.mockResolvedValue(updatedProduct);

      const result = await service.updateStock(productId, quantity);

      expect(result.stock).toBe(15);
    });

    it('should throw error for insufficient stock', async () => {
      const productId = '1';
      const mockProduct = {
        id: productId,
        stock: 5,
        trackInventory: true,
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      await expect(service.updateStock(productId, -10)).rejects.toThrow();
    });
  });
});

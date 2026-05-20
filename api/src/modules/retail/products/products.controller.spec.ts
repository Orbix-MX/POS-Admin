import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';
import { ProductStatus } from '@prisma/client';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsService;

  const mockProductsService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    })
      .overrideGuard(require('../../../common/guards/require-module.guard').RequireModule)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProductsController>(ProductsController);
    service = module.get<ProductsService>(ProductsService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    const paginatedResponse = {
      data: [
        {
          id: '1',
          sku: 'TEST-001',
          name: 'Test Product',
          price: 99.99,
          status: ProductStatus.ACTIVE,
          category: null,
          images: [],
        },
      ],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    };

    it('should call service.findAll with queryDto and return result', async () => {
      const queryDto: QueryProductDto = { page: 1, limit: 10, skip: 0 };
      mockProductsService.findAll.mockResolvedValue(paginatedResponse);

      const result = await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(queryDto);
      expect(result).toBe(paginatedResponse);
    });

    it('should pass search filter to service', async () => {
      const queryDto: QueryProductDto = { page: 1, limit: 10, skip: 0, search: 'laptop' };
      mockProductsService.findAll.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'laptop' }),
      );
    });

    it('should pass categoryId filter to service', async () => {
      const queryDto: QueryProductDto = {
        page: 1,
        limit: 10,
        skip: 0,
        categoryId: 'cat-uuid-123',
      };
      mockProductsService.findAll.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 'cat-uuid-123' }),
      );
    });

    it('should pass status filter to service', async () => {
      const queryDto: QueryProductDto = {
        page: 1,
        limit: 10,
        skip: 0,
        status: ProductStatus.INACTIVE,
      };
      mockProductsService.findAll.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } });

      await controller.findAll(queryDto);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: ProductStatus.INACTIVE }),
      );
    });

    it('should return empty page when no products match', async () => {
      const queryDto: QueryProductDto = { page: 1, limit: 10, skip: 0, search: 'nonexistent' };
      const emptyResponse = { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
      mockProductsService.findAll.mockResolvedValue(emptyResponse);

      const result = await controller.findAll(queryDto);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('should propagate service errors', async () => {
      const queryDto: QueryProductDto = { page: 1, limit: 10, skip: 0 };
      mockProductsService.findAll.mockRejectedValue(new Error('DB error'));

      await expect(controller.findAll(queryDto)).rejects.toThrow('DB error');
    });
  });
});

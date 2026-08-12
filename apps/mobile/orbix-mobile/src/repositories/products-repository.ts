import type {
  CategoryDto,
  CreateCategoryRequest,
  CreateProductRequest,
  PaginatedDto,
  ProductDto,
  UpdateProductRequest,
} from '@/dto/products.dto';
import { http } from '@/services/api';

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  comparePrice: number | null;
  costPrice: number | null;
  type: ProductDto['type'];
  categoryId: string | null;
  categoryName: string | null;
  status: ProductDto['status'];
  stock: number;
  trackInventory: boolean;
  lowStockAlert: number;
  taxRate: number | null;
  taxCode: ProductDto['taxCode'];
  isEcommerce: boolean;
}

export interface ProductListResult {
  products: Product[];
  meta: PaginatedDto<ProductDto>['meta'];
}

export interface ProductListParams {
  search?: string;
  categoryId?: string;
  status?: ProductDto['status'];
  type?: ProductDto['type'];
  page?: number;
  limit?: number;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDomain(dto: ProductDto): Product {
  return {
    id: dto.id,
    sku: dto.sku,
    name: dto.name,
    slug: dto.slug,
    description: dto.description ?? '',
    price: toNumber(dto.price) ?? 0,
    comparePrice: toNumber(dto.comparePrice),
    costPrice: toNumber(dto.costPrice),
    type: dto.type,
    categoryId: dto.categoryId,
    categoryName: dto.category?.name ?? null,
    status: dto.status,
    stock: dto.stock,
    trackInventory: dto.trackInventory,
    lowStockAlert: dto.lowStockAlert,
    taxRate: toNumber(dto.taxRate),
    taxCode: dto.taxCode,
    isEcommerce: dto.isEcommerce,
  };
}

export const productsRepository = {
  async list(params: ProductListParams): Promise<ProductListResult> {
    const dto = await http.get<PaginatedDto<ProductDto>>('/products', { params });
    return { products: dto.data.map(toDomain), meta: dto.meta };
  },

  async getById(id: string): Promise<Product> {
    const dto = await http.get<ProductDto>(`/products/${id}`);
    return toDomain(dto);
  },

  async create(request: CreateProductRequest): Promise<Product> {
    const dto = await http.post<ProductDto>('/products', request);
    return toDomain(dto);
  },

  async update(id: string, request: UpdateProductRequest): Promise<Product> {
    const dto = await http.patch<ProductDto>(`/products/${id}`, request);
    return toDomain(dto);
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/products/${id}`);
  },
} as const;

export const categoriesRepository = {
  async list(): Promise<CategoryDto[]> {
    return http.get<CategoryDto[]>('/categories');
  },

  async create(request: CreateCategoryRequest): Promise<CategoryDto> {
    return http.post<CategoryDto>('/categories', request);
  },
} as const;

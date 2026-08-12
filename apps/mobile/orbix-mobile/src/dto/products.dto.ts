/**
 * `/products` and `/categories` — shapes taken from `ProductsService`/
 * `CategoriesService` (`api/src/modules/retail/{products,categories}`).
 *
 * Decimal fields (`price`, `comparePrice`, `costPrice`, `taxRate`) serialise as
 * strings over JSON, same rationale as `DashboardStatsDto.totalRevenue`.
 */
import type { ProductStatus, ProductType, TaxCode } from '@/types/api';

export interface ProductDto {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  price: string | number;
  comparePrice: string | number | null;
  costPrice: string | number | null;
  type: ProductType;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  status: ProductStatus;
  stock: number;
  trackInventory: boolean;
  lowStockAlert: number;
  taxRate: string | number | null;
  taxCode: TaxCode | null;
  isEcommerce: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedDto<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CategoryDto {
  id: string;
  name: string;
  parentId: string | null;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface CreateProductRequest {
  type?: ProductType;
  sku: string;
  name: string;
  description?: string;
  price: number;
  comparePrice?: number;
  costPrice?: number;
  categoryId?: string;
  status?: ProductStatus;
  stock?: number;
  trackInventory?: boolean;
  lowStockAlert?: number;
  taxRate?: number;
  taxCode?: TaxCode;
  isEcommerce?: boolean;
}

export type UpdateProductRequest = Partial<CreateProductRequest>;

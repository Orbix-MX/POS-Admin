/**
 * `/customers` — shapes taken from `CustomersService` (`api/src/modules/core/customers`).
 *
 * `totalSpent` is a Decimal field and serialises as a string over JSON, same
 * rationale as `ProductDto.price`.
 */
import type { CustomerStatus, CustomerType } from '@/types/api';

export interface CustomerDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  company: string | null;
  city: string | null;
  status: CustomerStatus;
  type: CustomerType;
  totalOrders: number;
  totalSpent: string | number;
  hasCredit: boolean;
  creditLimit: string | number | null;
  creditDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedDto<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateCustomerRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  city?: string;
  status?: CustomerStatus;
  type?: CustomerType;
  hasCredit?: boolean;
  creditLimit?: number;
  creditDays?: number;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;

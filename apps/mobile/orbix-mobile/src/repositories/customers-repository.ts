import type {
  CreateCustomerRequest,
  CustomerDto,
  PaginatedDto,
  UpdateCustomerRequest,
} from '@/dto/customers.dto';
import { http } from '@/services/api';

export interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  company: string | null;
  city: string | null;
  status: CustomerDto['status'];
  type: CustomerDto['type'];
  totalOrders: number;
  totalSpent: number;
  hasCredit: boolean;
  creditLimit: number | null;
  creditDays: number;
}

export interface CustomerListResult {
  customers: Customer[];
  meta: PaginatedDto<CustomerDto>['meta'];
}

export interface CustomerListParams {
  search?: string;
  status?: CustomerDto['status'];
  type?: CustomerDto['type'];
  page?: number;
  limit?: number;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDomain(dto: CustomerDto): Customer {
  return {
    id: dto.id,
    email: dto.email,
    firstName: dto.firstName,
    lastName: dto.lastName,
    phone: dto.phone,
    company: dto.company,
    city: dto.city,
    status: dto.status,
    type: dto.type,
    totalOrders: dto.totalOrders,
    totalSpent: toNumber(dto.totalSpent) ?? 0,
    hasCredit: dto.hasCredit,
    creditLimit: toNumber(dto.creditLimit),
    creditDays: dto.creditDays,
  };
}

export const customersRepository = {
  async list(params: CustomerListParams): Promise<CustomerListResult> {
    const dto = await http.get<PaginatedDto<CustomerDto>>('/customers', { params });
    return { customers: dto.data.map(toDomain), meta: dto.meta };
  },

  async getById(id: string): Promise<Customer> {
    const dto = await http.get<CustomerDto>(`/customers/${id}`);
    return toDomain(dto);
  },

  async create(request: CreateCustomerRequest): Promise<Customer> {
    const dto = await http.post<CustomerDto>('/customers', request);
    return toDomain(dto);
  },

  async update(id: string, request: UpdateCustomerRequest): Promise<Customer> {
    const dto = await http.patch<CustomerDto>(`/customers/${id}`, request);
    return toDomain(dto);
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/customers/${id}`);
  },
} as const;

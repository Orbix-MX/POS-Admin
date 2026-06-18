import { api } from '@/lib/api-client';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED';

export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  displayOrder: number;
  isActive: boolean;
  status: TableStatus;
  areaId: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
  area: { id: string; name: string };
}

export interface CreateTableInput {
  name: string;
  areaId: string;
  capacity?: number;
  displayOrder?: number;
}

export interface UpdateTableInput {
  name?: string;
  areaId?: string;
  capacity?: number;
  displayOrder?: number;
  isActive?: boolean;
  status?: TableStatus;
}

export async function fetchTables(branchId: string, areaId?: string): Promise<RestaurantTable[]> {
  const params = areaId ? `?areaId=${areaId}` : '';
  const { data } = await api.get<RestaurantTable[]>(`/branches/${branchId}/tables${params}`);
  return data;
}

export async function createTable(branchId: string, input: CreateTableInput): Promise<RestaurantTable> {
  const { data } = await api.post<RestaurantTable>(`/branches/${branchId}/tables`, input);
  return data;
}

export async function updateTable(branchId: string, id: string, input: UpdateTableInput): Promise<RestaurantTable> {
  const { data } = await api.patch<RestaurantTable>(`/branches/${branchId}/tables/${id}`, input);
  return data;
}

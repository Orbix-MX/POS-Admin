import { apiClient } from './api-client';

export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED';

export interface DiningArea {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export interface RestaurantTable {
  id: string;
  name: string;
  capacity: number;
  displayOrder: number;
  isActive: boolean;
  status: TableStatus;
  areaId: string;
  area: { id: string; name: string };
}

export async function fetchDiningAreas(branchId: string): Promise<DiningArea[]> {
  const { data } = await apiClient.get<DiningArea[]>(`/branches/${branchId}/dining-areas`);
  return data;
}

export async function fetchTables(branchId: string): Promise<RestaurantTable[]> {
  const { data } = await apiClient.get<RestaurantTable[]>(`/branches/${branchId}/tables`);
  return data;
}

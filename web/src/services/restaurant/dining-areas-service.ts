import { api } from '@/lib/api-client';

export interface DiningArea {
  id: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiningAreaInput {
  name: string;
  description?: string;
  displayOrder?: number;
}

export interface UpdateDiningAreaInput {
  name?: string;
  description?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export async function fetchDiningAreas(branchId: string): Promise<DiningArea[]> {
  const { data } = await api.get<DiningArea[]>(`/branches/${branchId}/dining-areas`);
  return data;
}

export async function createDiningArea(branchId: string, input: CreateDiningAreaInput): Promise<DiningArea> {
  const { data } = await api.post<DiningArea>(`/branches/${branchId}/dining-areas`, input);
  return data;
}

export async function updateDiningArea(branchId: string, id: string, input: UpdateDiningAreaInput): Promise<DiningArea> {
  const { data } = await api.patch<DiningArea>(`/branches/${branchId}/dining-areas/${id}`, input);
  return data;
}

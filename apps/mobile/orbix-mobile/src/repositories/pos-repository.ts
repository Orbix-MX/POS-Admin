/**
 * `/branches` — las sucursales del tenant.
 *
 * Lo de caja se fue a `cash-repository.ts` y lo de ventas a
 * `orders-repository.ts` cuando el ciclo del día dejó de caber en un archivo.
 */
import type { BranchDto } from '@/dto/pos.dto';
import { http } from '@/services/api';

export interface Branch {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
}

export const branchesRepository = {
  async list(): Promise<Branch[]> {
    return http.get<BranchDto[]>('/branches');
  },
} as const;

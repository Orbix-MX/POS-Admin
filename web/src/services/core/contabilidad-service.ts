import { api } from '@/lib/api-client'
export type { ContabilidadData, CuentaCobrar, CuentaPagar } from '@/types/erp'
import type { ContabilidadData } from '@/types/erp'

export async function fetchContabilidad(): Promise<ContabilidadData> {
  const { data } = await api.get<ContabilidadData>('/api/contabilidad')
  return data
}

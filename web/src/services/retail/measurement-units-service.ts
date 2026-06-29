import { api } from '@/lib/api-client'

export type UnitCategory = 'WEIGHT' | 'VOLUME' | 'COUNT'

export interface MeasurementUnit {
  id: string
  name: string
  symbol: string
  category: UnitCategory
  baseFactor: number
  isBase: boolean
  isSystem: boolean
}

let _cache: MeasurementUnit[] | null = null

export async function fetchMeasurementUnits(): Promise<MeasurementUnit[]> {
  if (_cache) return _cache
  const { data } = await api.get<MeasurementUnit[]>('measurement-units')
  _cache = data
  return data
}

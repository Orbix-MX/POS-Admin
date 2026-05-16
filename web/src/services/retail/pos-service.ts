import { api } from '@/lib/api-client'
export type { POSProducto, POSCliente, CarritoItem } from '@/types/erp'
import type { POSProducto, POSCliente } from '@/types/erp'

export async function fetchPOSProductos(): Promise<POSProducto[]> {
  const { data } = await api.get<POSProducto[]>('/api/pos/productos')
  return data
}

export async function fetchPOSClientes(): Promise<POSCliente[]> {
  const { data } = await api.get<POSCliente[]>('/api/pos/clientes')
  return data
}

export interface VentaPOSInput {
  clienteId: string | null
  items: Array<{ productoId: number; qty: number; precio: number }>
  subtotal: number
  descuentos: number
  total: number
  metodoPago: string
}

export async function registrarVentaPOS(data: VentaPOSInput): Promise<{ folio: string }> {
  const { data: result } = await api.post<{ folio: string }>('/api/pos/ventas', data)
  return result
}

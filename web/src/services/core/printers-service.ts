import { api } from '@/lib/api-client'

export type PrinterType       = 'TICKET' | 'SALE_TICKET' | 'LABEL' | 'REPORT'
export type PrinterConnection = 'USB' | 'NETWORK' | 'BLUETOOTH' | 'SYSTEM'

export interface PrinterConfig {
  id:               string
  tenantId:         string
  branchId:         string | null
  name:             string
  type:             PrinterType
  connectionType:   PrinterConnection
  ipAddress:        string | null
  port:             number | null
  usbPath:          string | null
  bluetoothAddress: string | null
  systemName:       string | null
  paperWidth:       number | null
  isDefault:        boolean
  isActive:         boolean
  createdAt:        string
  branch?:          { id: string; name: string } | null
}

export interface PrinterConfigInput {
  name:             string
  branchId?:        string | null
  type:             PrinterType
  connectionType:   PrinterConnection
  ipAddress?:       string
  port?:            number
  usbPath?:         string
  bluetoothAddress?: string
  systemName?:      string
  paperWidth?:      number
  isDefault?:       boolean
  isActive?:        boolean
}

export async function fetchPrinters(): Promise<PrinterConfig[]> {
  const { data } = await api.get<PrinterConfig[]>('/printer-configs')
  return data
}

export async function createPrinter(dto: PrinterConfigInput): Promise<PrinterConfig> {
  const { data } = await api.post<PrinterConfig>('/printer-configs', dto)
  return data
}

export async function updatePrinter(id: string, dto: PrinterConfigInput): Promise<PrinterConfig> {
  const { data } = await api.patch<PrinterConfig>(`/printer-configs/${id}`, dto)
  return data
}

export async function deletePrinter(id: string): Promise<void> {
  await api.delete(`/printer-configs/${id}`)
}

export async function printReceiptForOrder(
  orderId: string,
  printerType: PrinterType = 'SALE_TICKET',
): Promise<{ success: boolean; reason?: string }> {
  const { data } = await api.post<{ success: boolean; reason?: string }>(
    '/printer-configs/print-receipt',
    { orderId, printerType },
  )
  return data
}

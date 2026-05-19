import { api } from '@/lib/api-client'
import type { ListResponse } from '@/interfaces/list-response'

export type WorkOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'

export interface WorkOrderAssignment {
  id: string
  workOrderId: string
  userId: string
  startedAt: string | null
  finishedAt: string | null
  notes: string | null
  createdAt: string
  user: { id: string; firstName: string; lastName: string; email: string }
}

export interface WorkOrder {
  id: string
  tenantId: string
  orderNumber: string
  customerId: string
  serviceId: string | null
  description: string
  status: WorkOrderStatus
  dueDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; firstName: string; lastName: string; email: string; phone?: string | null }
  service: { id: string; name: string; basePrice: number | string } | null
  createdBy: { id: string; firstName: string; lastName: string } | null
  assignments: WorkOrderAssignment[]
  quoteLink: {
    workOrderId: string
    serviceQuoteId: string
    serviceQuote: { id: string; quoteNumber: string; status: string; total: number | string }
  } | null
}

export interface CreateWorkOrderPayload {
  customerId: string
  description: string
  serviceId?: string
  dueDate?: string
  notes?: string
  serviceQuoteId?: string
}

export interface UpdateWorkOrderPayload {
  description?: string
  status?: WorkOrderStatus
  dueDate?: string | null
  notes?: string
}

export async function fetchWorkOrders(params?: {
  status?: WorkOrderStatus
  customerId?: string
  search?: string
  page?: number
  limit?: number
}): Promise<ListResponse<WorkOrder>> {
  const res = await api.get<ListResponse<WorkOrder>>('/work-orders', { params })
  return res.data
}

export async function fetchWorkOrder(id: string): Promise<WorkOrder> {
  const res = await api.get<WorkOrder>(`/work-orders/${id}`)
  return res.data
}

export async function createWorkOrder(payload: CreateWorkOrderPayload): Promise<WorkOrder> {
  const res = await api.post<WorkOrder>('/work-orders', payload)
  return res.data
}

export async function updateWorkOrder(id: string, payload: UpdateWorkOrderPayload): Promise<WorkOrder> {
  const res = await api.patch<WorkOrder>(`/work-orders/${id}`, payload)
  return res.data
}

export async function assignUser(id: string, userId: string): Promise<WorkOrderAssignment> {
  const res = await api.post<WorkOrderAssignment>(`/work-orders/${id}/assign`, { userId })
  return res.data
}

export async function startAssignment(id: string, assignmentId: string): Promise<WorkOrder> {
  const res = await api.patch<WorkOrder>(`/work-orders/${id}/assignments/${assignmentId}/start`)
  return res.data
}

export async function finishAssignment(id: string, assignmentId: string): Promise<WorkOrder> {
  const res = await api.patch<WorkOrder>(`/work-orders/${id}/assignments/${assignmentId}/finish`)
  return res.data
}

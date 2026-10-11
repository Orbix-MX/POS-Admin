import { platformApi } from '@/lib/platform-api-client'
import type { TenantPlan, TenantStatus } from './platform-tenants-service'

export type UpgradeRequestStatus = 'PENDING' | 'HANDLED' | 'CANCELLED'

/** Solicitud de "Mejorar plan" que manda la app. @odd planes-self-service T-003 */
export interface UpgradeRequest {
  id: string
  tenantId: string
  currentPlan: TenantPlan
  requestedPlan: TenantPlan
  note: string | null
  status: UpgradeRequestStatus
  handledById: string | null
  handledAt: string | null
  createdAt: string
  updatedAt: string
  tenant: { id: string; name: string; slug: string; plan: TenantPlan; status: TenantStatus }
  requestedBy: { id: string; email: string; firstName: string; lastName: string }
}

export async function fetchUpgradeRequests(status: UpgradeRequestStatus = 'PENDING'): Promise<UpgradeRequest[]> {
  const { data } = await platformApi.get<UpgradeRequest[]>('/platform/upgrade-requests', { params: { status } })
  return data
}

/** Solo desde pendiente: una ya resuelta responde 404. */
export async function resolveUpgradeRequest(id: string, status: 'HANDLED' | 'CANCELLED') {
  const { data } = await platformApi.patch(`/platform/upgrade-requests/${id}`, { status })
  return data
}

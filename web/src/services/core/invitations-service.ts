import { api } from '@/lib/api-client'

export interface InvitationPreview {
  email: string
  tenantName: string
  invitedByName: string | null
  /** true si ya tiene cuenta: entonces se le pide iniciar sesión, no fijar una contraseña. */
  accountExists: boolean
  expiresAt: string
}

export interface PendingInvitation {
  id: string
  email: string
  roleIds: string[]
  expiresAt: string
  createdAt: string
}

export interface CreateInvitationInput {
  email: string
  roleIds?: string[]
}

/** Solo aplica cuando el correo invitado no tenía cuenta todavía. */
export interface AcceptInvitationInput {
  firstName?: string
  lastName?: string
  password?: string
}

export interface AcceptInvitationResult {
  tenantId: string
  tenantSlug: string
}

export async function fetchInvitationPreview(token: string): Promise<InvitationPreview> {
  const { data } = await api.get<InvitationPreview>(`/invitations/${token}`)
  return data
}

export async function acceptInvitation(
  token: string,
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  const { data } = await api.post<AcceptInvitationResult>(`/invitations/${token}/accept`, input)
  return data
}

export async function createInvitation(input: CreateInvitationInput): Promise<{ id: string; expiresAt: string }> {
  const { data } = await api.post('/users/invitations', input)
  return data
}

export async function fetchPendingInvitations(): Promise<PendingInvitation[]> {
  const { data } = await api.get<PendingInvitation[]>('/users/invitations')
  return data
}

export async function revokeInvitation(id: string): Promise<void> {
  await api.delete(`/users/invitations/${id}`)
}

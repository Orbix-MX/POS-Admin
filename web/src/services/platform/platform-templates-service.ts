import { platformApi } from '@/lib/platform-api-client'
import type { SiteSectionType } from '@/components/site-sections/types'

export type { SiteSectionType }

// El HTML/las secciones de una plantilla son fijas en código (Astro) — un
// Template aquí es solo el registro de nombre/estado que se asigna a un
// tenant, no algo que se compone desde el panel.
export interface Template {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { tenantSites: number }
}

export interface TenantSiteSection {
  id: string
  tenantId: string
  sectionType: SiteSectionType
  sortOrder: number
  isActive: boolean
  content: Record<string, unknown>
}

export interface TenantSite {
  tenantId: string
  templateId: string
  template: { id: string; name: string }
  siteSections: TenantSiteSection[]
}

export async function fetchTemplates(): Promise<Template[]> {
  const { data } = await platformApi.get('/platform/templates')
  return data
}

export async function createTemplate(name: string): Promise<Template> {
  const { data } = await platformApi.post('/platform/templates', { name })
  return data
}

export async function updateTemplate(id: string, patch: { name?: string; isActive?: boolean }): Promise<Template> {
  const { data } = await platformApi.patch(`/platform/templates/${id}`, patch)
  return data
}

export async function fetchTenantSite(tenantId: string): Promise<TenantSite | null> {
  try {
    const { data } = await platformApi.get(`/platform/tenants/${tenantId}/site`)
    return data
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } }
    if (err?.response?.status === 404) return null
    throw e
  }
}

export async function assignTenantTemplate(tenantId: string, templateId: string): Promise<TenantSite> {
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/site`, { templateId })
  return data
}

export async function removeTenantSite(tenantId: string): Promise<void> {
  await platformApi.delete(`/platform/tenants/${tenantId}/site`)
}

// ── Edición del contenido en vivo del tenant, desde plataforma ─────────────
// Mismo SiteService que usa el propio tenant en /site/current — cambia
// solo quién llama (token de plataforma + :tenantId en la URL).

export async function updateTenantSiteSection(
  tenantId: string,
  sectionId: string,
  patch: { content?: Record<string, unknown>; isActive?: boolean },
): Promise<TenantSiteSection> {
  const { data } = await platformApi.patch(`/platform/tenants/${tenantId}/site/sections/${sectionId}`, patch)
  return data
}

export async function reorderTenantSiteSections(tenantId: string, order: string[]): Promise<TenantSite> {
  const { data } = await platformApi.patch(`/platform/tenants/${tenantId}/site/sections/reorder`, { order })
  return data
}

export async function uploadTenantSiteImage(tenantId: string, file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await platformApi.post(`/platform/tenants/${tenantId}/site/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

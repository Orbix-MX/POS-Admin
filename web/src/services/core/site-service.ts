import { api } from '@/lib/api-client'
import type { EditableSection } from '@/components/site-sections/types'

export type {
  SiteSectionType, IconItem, TestimonialItem,
  HeroContent, ValuePropsContent, FeaturedCategoriesContent, FeaturedProductsContent,
  TestimonialsContent, ContactFooterContent,
} from '@/components/site-sections/types'

export type SiteSection = EditableSection

export interface TenantSite {
  tenantId: string
  templateId: string
  template: { id: string; name: string }
  siteSections: SiteSection[]
}

export async function fetchMySite(): Promise<TenantSite> {
  const { data } = await api.get<TenantSite>('site/current')
  return data
}

export async function updateSiteSection(
  sectionId: string,
  patch: { content?: Record<string, unknown>; isActive?: boolean },
): Promise<SiteSection> {
  const { data } = await api.patch<SiteSection>(`site/current/sections/${sectionId}`, patch)
  return data
}

export async function reorderSiteSections(order: string[]): Promise<TenantSite> {
  const { data } = await api.patch<TenantSite>('site/current/sections/reorder', { order })
  return data
}

export async function uploadSiteImage(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<{ url: string }>('site/current/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

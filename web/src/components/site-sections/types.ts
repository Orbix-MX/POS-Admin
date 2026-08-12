// Formas de contenido de cada tipo de sección de "tienda en línea" — únicas
// para todo el frontend (tenant-facing /tienda-online y platform-facing
// /platform/empresas/:id → pestaña "Tienda en línea"), para no duplicarlas.

export type SiteSectionType =
  | 'HERO'
  | 'VALUE_PROPS'
  | 'FEATURED_CATEGORIES'
  | 'FEATURED_PRODUCTS'
  | 'TESTIMONIALS'
  | 'CONTACT_FOOTER'

export interface IconItem {
  icon?: string
  title: string
  text: string
}

export interface TestimonialItem {
  author: string
  quote: string
  avatarUrl?: string
}

export interface HeroContent {
  title?: string
  subtitle?: string
  backgroundImageUrl?: string
}

export interface ValuePropsContent {
  items?: IconItem[]
}

export interface FeaturedCategoriesContent {
  title?: string
  subtitle?: string
  items?: IconItem[]
}

export interface FeaturedProductsContent {
  title?: string
  subtitle?: string
}

export interface TestimonialsContent {
  title?: string
  subtitle?: string
  items?: TestimonialItem[]
}

export interface ContactFooterContent {
  title?: string
  subtitle?: string
  whatsappNumber?: string
}

/** Forma mínima que necesita SectionCard — la satisfacen tanto SiteSection
 *  (core, del propio tenant) como TenantSiteSection (platform). */
export interface EditableSection {
  id: string
  sectionType: SiteSectionType
  sortOrder: number
  isActive: boolean
  content: Record<string, unknown>
}

export const SECTION_META: Record<SiteSectionType, { label: string; description: string }> = {
  HERO: { label: 'Portada', description: 'Título, subtítulo e imagen de fondo de la página de inicio' },
  VALUE_PROPS: { label: 'Por qué elegirnos', description: 'Tarjetas cortas debajo de la portada' },
  FEATURED_CATEGORIES: { label: 'Categorías destacadas', description: 'Bloque de categorías que quieres resaltar' },
  FEATURED_PRODUCTS: { label: 'Catálogo destacado', description: 'Encabezado sobre la vitrina de productos' },
  TESTIMONIALS: { label: 'Testimonios', description: 'Opiniones de clientes' },
  CONTACT_FOOTER: { label: 'Contacto', description: 'Franja final de contacto / WhatsApp' },
}

import { SiteSectionType } from '@prisma/client';

// El HTML de la plantilla es fijo (código Astro) — no se compone por
// plataforma. Este es el contenido con el que se "llena" cada sección al
// asignar/sincronizar, tomado del copy original de apps/e-commerce; el
// tenant lo edita después en Tienda en línea. Compartido entre SiteService
// (autocompleta secciones que falten al leer) y PlatformTemplatesService
// (las crea todas al asignar una plantilla).
export const DEFAULT_SITE_SECTIONS: Array<{ sectionType: SiteSectionType; sortOrder: number; defaultContent: Record<string, unknown> }> = [
  {
    sectionType: 'HERO',
    sortOrder: 0,
    defaultContent: {
      title: 'Naturaleza para tu acuario',
      subtitle: 'Plantas acuáticas, raíces y hardscape para tu proyecto.',
    },
  },
  {
    sectionType: 'FEATURED_CATEGORIES',
    sortOrder: 1,
    defaultContent: {
      title: 'Todo lo que tu acuario necesita',
      subtitle: 'Cultivamos, seleccionamos y preparamos cada pieza pensando en acuarios plantados reales, no en escaparates.',
      items: [
        { icon: '🌿', title: 'Plantas Acuáticas', text: 'Más de cincuenta especies cultivadas en nuestras piletas, desde tapizantes exigentes hasta rizomatosas de bajo mantenimiento. Libres de caracoles y algas.' },
        { icon: '🪵', title: 'Raíz de Manzanita', text: 'Ramas curadas, lavadas y listas para sumergir. Seleccionamos cada pieza por su silueta para que tu bosque submarino tenga carácter propio.' },
        { icon: '🪨', title: 'Hardscape', text: 'Seiryu, roca dragón, lava negra y sustratos técnicos. Estamos preparando la selección; escríbenos por WhatsApp si buscas una pieza en particular.' },
      ],
    },
  },
  {
    sectionType: 'FEATURED_PRODUCTS',
    sortOrder: 2,
    defaultContent: {
      title: 'Selección destacada',
      subtitle: 'Una muestra de lo que tenemos disponible esta temporada. El catálogo completo incluye plantas, raíces y hardscape con precios actualizados.',
    },
  },
  {
    sectionType: 'VALUE_PROPS',
    sortOrder: 3,
    defaultContent: {
      items: [
        { icon: '🧪', title: 'Libre de plagas', text: 'Cada lote se revisa y enjuaga antes de salir. Sin caracoles, planaria ni algas.' },
        { icon: '📦', title: 'Empaque protegido', text: 'Humedad controlada y aislante térmico para que el viaje no marchite nada.' },
        { icon: '💬', title: 'Asesoría real', text: 'Te ayudamos a elegir según tu luz, tu sustrato y si usas CO₂ o no.' },
      ],
    },
  },
  {
    sectionType: 'TESTIMONIALS',
    sortOrder: 4,
    defaultContent: { items: [] }, // sin equivalente estático — queda vacía hasta que el tenant la llene
  },
  {
    sectionType: 'CONTACT_FOOTER',
    sortOrder: 5,
    defaultContent: {
      title: '¿No sabes por dónde empezar?',
      subtitle: 'Cuéntanos las medidas de tu acuario, tu iluminación y el estilo que buscas. Te armamos una lista de plantas y hardscape a la medida, sin compromiso.',
      whatsappNumber: '', // número real del tenant — no se asume ninguno por defecto
    },
  },
];

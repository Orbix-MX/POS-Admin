import type { CSSProperties } from 'react'

/**
 * Iconografía del diseño de Orbix POS. Los paths salen literalmente del
 * `Orbix POS.dc.html`; se mantienen aquí en lugar de sustituirlos por
 * lucide-react para no cambiar el trazo del diseño.
 */

export type IconName =
  | 'home'
  | 'cart'
  | 'cash'
  | 'receipt'
  | 'box'
  | 'users'
  | 'chart'
  | 'card'
  | 'transfer'
  | 'split'
  | 'search'
  | 'grid'
  | 'list'
  | 'sort'
  | 'check'
  | 'user'

export const ICON_PATHS: Record<IconName, string> = {
  home: 'M3 10.5L12 3l9 7.5|M5.5 9.5V21h13V9.5',
  cart: '',
  cash: '',
  receipt: 'M5 2.5h14v19l-3.5-2-3.5 2-3.5-2L5 21.5z|M9 8h6|M9 12h6',
  box: 'M21 8L12 3.2 3 8v8l9 4.8 9-4.8z|M3 8l9 4.8L21 8',
  users: '',
  chart: 'M4 20V10|M10 20V4|M16 20v-7|M22 20H2',
  card: '',
  transfer: 'M4 8h13l-3-3|M20 16H7l3 3',
  split: 'M12 3v18|M4 8h5|M15 16h5',
  search: '',
  grid: '',
  list: 'M4 7h16|M4 12h16|M4 17h10',
  sort: 'M4 7h13|M4 12h9|M4 17h5|M18 11v9|M15.5 17.5L18 20l2.5-2.5',
  check: 'M4 12.5l5 5L20 6.5',
  user: '',
}

interface IconProps {
  name: IconName
  size?: number
  strokeWidth?: number
  color?: string
  style?: CSSProperties
}

/**
 * Los iconos con círculos/rects no se pueden expresar solo con `d`, así que
 * se declaran completos aquí.
 */
function shapes(name: IconName, strokeWidth: number) {
  switch (name) {
    case 'cart':
      return (
        <>
          <path d="M3 4h2.2l2.4 11h10.2L21 7H6.2" />
          <circle cx="9.5" cy="19.5" r="1.5" />
          <circle cx="17.5" cy="19.5" r="1.5" />
        </>
      )
    case 'cash':
      return (
        <>
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.4" />
        </>
      )
    case 'users':
    case 'user':
      return (
        <>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" />
        </>
      )
    case 'card':
      return (
        <>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="M2.5 10h19" />
        </>
      )
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </>
      )
    case 'grid':
      return (
        <>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" />
        </>
      )
    default:
      return ICON_PATHS[name]
      .split('|')
      .filter(Boolean)
      .map((d, i) => <path key={i} d={d} strokeWidth={strokeWidth} />)
  }
}

export function Icon({ name, size = 20, strokeWidth = 1.8, color = 'currentColor', style }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {shapes(name, strokeWidth)}
    </svg>
  )
}

/** Iconos de categoría del catálogo — se asignan cíclicamente por categoría real del tenant. */
export const CATEGORY_ICON_PATHS: string[] = [
  '<path d="M9 3h6l-1 4h-4z"></path><path d="M10 7h4v5l-2 9-2-9z"></path><path d="M10 10h4"></path><path d="M10 13h4"></path>',
  '<path d="M14.5 5.5a3.6 3.6 0 004.9 4.7l-9 9a2.1 2.1 0 01-3-3l9-9z"></path><path d="M5 5l3.5 3.5"></path><path d="M4.5 9.5L8 6"></path>',
  '<path d="M13.5 2.5L5 13.5h6l-1.5 8L18 10.5h-6z"></path>',
  '<path d="M12 3.5s6 6.3 6 10.1a6 6 0 01-12 0C6 9.8 12 3.5 12 3.5z"></path>',
  '<rect x="4" y="4" width="13" height="6" rx="1.6"></rect><path d="M17 7h3v4h-6"></path><path d="M13 11v3.5a1.5 1.5 0 01-1.5 1.5h-1A1.5 1.5 0 019 17.5V20"></path>',
  '<path d="M3 9.5h18"></path><path d="M3 14.5h18"></path><rect x="3" y="5" width="18" height="14" rx="1.8"></rect><path d="M9 5v4.5"></path><path d="M15 9.5V14.5"></path><path d="M9 14.5V19"></path>',
  '<path d="M12 3l7.5 3v5.5c0 4.6-3.1 8-7.5 9.5-4.4-1.5-7.5-4.9-7.5-9.5V6z"></path><path d="M9 12l2.2 2.2L15.5 10"></path>',
  '<path d="M21 8L12 3.2 3 8v8l9 4.8 9-4.8z"></path><path d="M3 8l9 4.8L21 8"></path>',
]

export function CategoryGlyph({ index, size = 30, strokeWidth = 1.6 }: { index: number; size?: number; strokeWidth?: number }) {
  const html = CATEGORY_ICON_PATHS[index % CATEGORY_ICON_PATHS.length]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

/** Paleta de categorías del diseño, aplicada por índice a las categorías del tenant. */
export const CATEGORY_COLORS = [
  'var(--chart-1)',
  'var(--chart-3)',
  'var(--chart-4)',
  'oklch(0.62 0.13 190)',
  'var(--chart-5)',
  'var(--chart-2)',
  'oklch(0.58 0.16 340)',
] as const

export const categoryColor = (index: number): string => CATEGORY_COLORS[index % CATEGORY_COLORS.length]
export const categoryTint = (index: number): string => `color-mix(in oklab, ${categoryColor(index)} 13%, white)`

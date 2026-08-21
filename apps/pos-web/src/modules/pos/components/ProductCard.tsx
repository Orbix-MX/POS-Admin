import { memo, useState } from 'react'
import type { Product } from '~/services/orbix'
import { categoryColor } from '~/components/shared/Icon'
import { amount } from '~/utils/money'

/**
 * Tarjeta de producto del catálogo. La imagen sale de `product.images`
 * (primaria si existe); cuando el producto no tiene imagen se pinta el
 * marcador con la inicial de la categoría, sin traer nada de fuera.
 */

interface ProductCardProps {
  product: Product
  categoryIndex: number
  categoryName: string
  onAdd: (product: Product) => void
  showStock: boolean
}

function stockBadge(product: Product): { label: string; bg: string; fg: string } | null {
  if (!product.trackInventory) return null
  const stock = Number(product.stock ?? 0)
  const low = Number(product.lowStockAlert ?? 0)
  if (stock <= 0) return { label: 'Agotado', bg: 'var(--semantic-red-bg)', fg: 'var(--semantic-red-fg)' }
  if (stock <= low) return { label: `${stock} restantes`, bg: 'var(--semantic-yellow-bg)', fg: 'var(--semantic-yellow-fg)' }
  return { label: `${stock}`, bg: 'var(--semantic-gray-bg)', fg: 'var(--semantic-gray-fg)' }
}

export const ProductCard = memo(function ProductCard({
  product,
  categoryIndex,
  categoryName,
  onAdd,
  showStock,
}: ProductCardProps) {
  const [hover, setHover] = useState(false)
  const color = categoryColor(categoryIndex)
  const badge = showStock ? stockBadge(product) : null
  const soldOut = product.trackInventory && Number(product.stock ?? 0) <= 0
  const image = product.images?.find((i) => i.isPrimary) ?? product.images?.[0]

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        background: 'var(--card)',
        border: `1px solid ${hover && !soldOut ? color : 'var(--hairline)'}`,
        borderRadius: 14,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        opacity: soldOut ? 0.55 : 1,
        transition: 'border-color .12s ease',
      }}
    >
      <div style={{ position: 'relative', height: 96, background: 'var(--neutral-100)' }}>
        {image ? (
          <img
            src={image.url}
            alt={image.altText ?? product.name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--muted-foreground)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {categoryName.slice(0, 12)}
          </div>
        )}

        {badge && (
          <span
            style={{
              position: 'absolute',
              top: 7,
              left: 7,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              borderRadius: 999,
              background: badge.bg,
              color: badge.fg,
              pointerEvents: 'none',
            }}
          >
            {badge.label}
          </span>
        )}

        <button
          type="button"
          onClick={() => onAdd(product)}
          disabled={soldOut}
          title={soldOut ? 'Sin existencia' : `Agregar ${product.name}`}
          aria-label={soldOut ? `${product.name} sin existencia` : `Agregar ${product.name}`}
          style={{
            position: 'absolute',
            right: 8,
            bottom: -15,
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '2px solid var(--card)',
            background: soldOut ? 'var(--neutral-400)' : color,
            color: 'var(--neutral-0)',
            fontFamily: 'inherit',
            fontSize: 18,
            fontWeight: 700,
            lineHeight: 1,
            cursor: soldOut ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 8px oklch(0.15 0.01 250 / 0.2)',
          }}
        >
          {soldOut ? '×' : '+'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onAdd(product)}
        disabled={soldOut}
        style={{
          padding: '9px 11px 11px',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          cursor: soldOut ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.25, textWrap: 'pretty', color: 'var(--foreground)', paddingRight: 28 }}>
          {product.name}
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>{product.sku}</span>
        <span style={{ marginTop: 'auto', paddingTop: 6, display: 'flex', alignItems: 'baseline', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>$</span>
          <span className="tabular" style={{ fontSize: 16.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>
            {amount(Number(product.price))}
          </span>
        </span>
      </button>
    </div>
  )
})

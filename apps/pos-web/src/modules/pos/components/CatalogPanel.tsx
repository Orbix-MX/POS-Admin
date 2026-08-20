import { useMemo, useState, type RefObject } from 'react'
import type { Product } from '~/services/orbix'
import { Input } from '~/components/ui/Input'
import { Button } from '~/components/ui/Button'
import { EmptyState, ErrorState, LoadingState } from '~/components/shared/StateBlock'
import { CategoryGlyph, Icon, categoryColor, categoryTint } from '~/components/shared/Icon'
import { ProductCard } from './ProductCard'
import { SORT_LABELS, matchesQuery, sortProducts, type CatalogCategory, type CatalogSort } from '~/hooks/use-catalog'

/**
 * Panel de catálogo: buscador, vista por categorías (mosaico) o listado
 * completo, filtro por categoría y rejilla de productos.
 *
 * El diseño trae dos vistas conmutables — «Categorías» (mosaico) y «Todo»
 * (rejilla con chips) — y ambas están implementadas aquí.
 */

export type CatalogView = 'tiles' | 'all'

interface CatalogPanelProps {
  products: Product[]
  categories: CatalogCategory[]
  categoryIndexOf: (p: Product) => number
  categoryNameOf: (p: Product) => string
  loading: boolean
  error: string | null
  onReload: () => void
  onAdd: (product: Product) => void
  /** Texto tal cual lo teclea el cajero (alimenta el input). */
  query: string
  /** Mismo texto con retardo: es el que filtra, para no re-renderizar en cada tecla. */
  filterQuery: string
  onQueryChange: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
}

export function CatalogPanel({
  products,
  categories,
  categoryIndexOf,
  categoryNameOf,
  loading,
  error,
  onReload,
  onAdd,
  query,
  filterQuery,
  onQueryChange,
  searchRef,
}: CatalogPanelProps) {
  const [view, setView] = useState<CatalogView>('tiles')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sort, setSort] = useState<CatalogSort>('relevance')
  const [sortOpen, setSortOpen] = useState(false)
  const [cameFromTiles, setCameFromTiles] = useState(false)

  const searching = query.trim().length > 0
  // Buscar siempre atraviesa el mosaico: el escáner debe encontrar el producto
  // sin importar en qué vista quedó el cajero.
  const effectiveView: CatalogView = searching ? 'all' : view

  const filtered = useMemo(() => {
    const base = products.filter((p) => matchesQuery(p, filterQuery))
    const byCategory = categoryId ? base.filter((p) => (p.categoryId || p.category?.id || '__none__') === categoryId) : base
    return sortProducts(byCategory, sort)
  }, [products, filterQuery, categoryId, sort])

  const activeCategory = categories.find((c) => c.id === categoryId) ?? null

  const openCategory = (id: string) => {
    setCategoryId(id)
    setCameFromTiles(true)
    setView('all')
  }

  const backToTiles = () => {
    setCategoryId(null)
    setCameFromTiles(false)
    setView('tiles')
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '16px 18px', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar por nombre, SKU o escanea el código de barras"
            aria-label="Buscar productos"
            style={{ height: 44, fontSize: 14, paddingLeft: 38 }}
          />
          <span style={{ position: 'absolute', left: 12, top: 12, pointerEvents: 'none' }}>
            <Icon name="search" size={19} color="var(--muted-foreground)" />
          </span>
          {searching && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label="Limpiar búsqueda"
              style={{
                position: 'absolute',
                right: 8,
                top: 9,
                width: 26,
                height: 26,
                borderRadius: 8,
                border: 'none',
                background: 'var(--muted)',
                color: 'var(--muted-foreground)',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-foreground)', fontSize: 11.5, fontWeight: 600 }}>
          <Kbd>F2</Kbd>
          <span>buscar</span>
          <Kbd style={{ marginLeft: 6 }}>F4</Kbd>
          <span>cobrar</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, background: 'var(--muted)', borderRadius: 11, padding: 3 }}>
          <ViewTab active={effectiveView === 'tiles'} icon="grid" label="Categorías" onClick={backToTiles} />
          <ViewTab
            active={effectiveView === 'all'}
            icon="list"
            label="Todo"
            onClick={() => {
              setView('all')
              setCameFromTiles(false)
            }}
          />
        </div>

        {cameFromTiles && activeCategory && effectiveView === 'all' && (
          <button
            type="button"
            onClick={backToTiles}
            style={{
              cursor: 'pointer',
              fontFamily: 'inherit',
              height: 36,
              padding: '0 14px 0 11px',
              borderRadius: 10,
              border: `1px solid ${categoryColor(activeCategory.index)}`,
              background: categoryTint(activeCategory.index),
              color: categoryColor(activeCategory.index),
              fontSize: 12.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>←</span>
            <span>{activeCategory.name}</span>
          </button>
        )}

        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>
            {effectiveView === 'tiles' ? `${categories.length} categorías` : `${filtered.length} productos`}
          </span>
          {effectiveView === 'all' && (
            <>
              <button
                type="button"
                onClick={() => setSortOpen((v) => !v)}
                aria-expanded={sortOpen}
                style={{
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  height: 36,
                  padding: '0 13px',
                  borderRadius: 10,
                  border: `1px solid ${sortOpen ? 'var(--primary)' : 'var(--border)'}`,
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Icon name="sort" size={15} strokeWidth={1.9} color="var(--muted-foreground)" />
                <span>{SORT_LABELS[sort]}</span>
              </button>
              {sortOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setSortOpen(false)} />
                  <div
                    role="listbox"
                    style={{
                      position: 'absolute',
                      top: 44,
                      right: 0,
                      zIndex: 20,
                      width: 230,
                      background: 'var(--card)',
                      border: '1px solid var(--hairline)',
                      borderRadius: 12,
                      boxShadow: '0 12px 30px oklch(0.15 0.01 250 / 0.16)',
                      padding: 5,
                    }}
                  >
                    {(Object.keys(SORT_LABELS) as CatalogSort[]).map((key) => {
                      const on = key === sort
                      return (
                        <button
                          key={key}
                          type="button"
                          role="option"
                          aria-selected={on}
                          onClick={() => {
                            setSort(key)
                            setSortOpen(false)
                          }}
                          style={{
                            cursor: 'pointer',
                            width: '100%',
                            fontFamily: 'inherit',
                            textAlign: 'left',
                            height: 38,
                            padding: '0 11px',
                            borderRadius: 9,
                            border: 'none',
                            background: on ? 'var(--muted)' : 'transparent',
                            color: 'var(--foreground)',
                            fontSize: 13,
                            fontWeight: on ? 700 : 500,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span>{SORT_LABELS[key]}</span>
                          {on && <span style={{ fontSize: 13, color: 'var(--primary)' }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState label="Cargando el catálogo…" minHeight={340} />
      ) : error ? (
        <ErrorState message={error} onRetry={onReload} minHeight={340} />
      ) : effectiveView === 'tiles' ? (
        <CategoryTiles categories={categories} onPick={openCategory} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <CategoryChip label="Todos" active={categoryId === null} index={-1} onClick={() => setCategoryId(null)} />
            {categories.map((c) => (
              <CategoryChip key={c.id} label={c.name} active={categoryId === c.id} index={c.index} onClick={() => setCategoryId(c.id)} />
            ))}
          </div>

          <div className="pos-scroll" style={{ flex: 1, minHeight: 0 }}>
            {filtered.length === 0 ? (
              <EmptyState
                minHeight={340}
                icon={<Icon name="search" size={24} color="var(--muted-foreground)" strokeWidth={1.8} />}
                title={searching ? `Sin resultados para "${query}"` : 'No hay productos en esta categoría'}
                message={
                  searching
                    ? 'Revisa el código o cambia los filtros. El catálogo es el mismo que administras en Orbix.'
                    : 'Selecciona otra categoría para seguir vendiendo.'
                }
                action={
                  searching ? (
                    <Button variant="outline" size="lg" style={{ height: 40 }} onClick={() => onQueryChange('')}>
                      Limpiar búsqueda
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 11,
                  alignContent: 'start',
                  paddingBottom: 8,
                }}
              >
                {filtered.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    categoryIndex={categoryIndexOf(p)}
                    categoryName={categoryNameOf(p)}
                    onAdd={onAdd}
                    showStock
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CategoryTiles({ categories, onPick }: { categories: CatalogCategory[]; onPick: (id: string) => void }) {
  if (categories.length === 0) {
    return (
      <EmptyState
        minHeight={340}
        icon={<Icon name="box" size={24} color="var(--muted-foreground)" strokeWidth={1.8} />}
        title="Sin productos activos"
        message="Publica productos desde el Admin Web para poder venderlos aquí."
      />
    )
  }

  return (
    <div className="pos-scroll" style={{ flex: 1, minHeight: 0, paddingTop: 2 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, alignContent: 'start', paddingBottom: 8 }}>
        {categories.map((c) => (
          <CategoryTile key={c.id} category={c} onPick={() => onPick(c.id)} />
        ))}
      </div>
    </div>
  )
}

function CategoryTile({ category, onPick }: { category: CatalogCategory; onPick: () => void }) {
  const [hover, setHover] = useState(false)
  const color = categoryColor(category.index)
  const tint = categoryTint(category.index)

  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer',
        fontFamily: 'inherit',
        background: hover ? tint : 'var(--card)',
        border: `1px solid ${hover ? color : 'var(--hairline)'}`,
        borderRadius: 18,
        padding: '24px 18px 20px',
        minHeight: 170,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        textAlign: 'center',
        transition: 'background .12s ease, border-color .12s ease',
      }}
    >
      <span style={{ width: 62, height: 62, borderRadius: 18, background: tint, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CategoryGlyph index={category.index} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--foreground)' }}>{category.name}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>
          {category.count} {category.count === 1 ? 'producto' : 'productos'}
        </span>
      </span>
      {category.lowStockCount > 0 && (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 999,
            background: 'var(--semantic-yellow-bg)',
            color: 'var(--semantic-yellow-fg)',
          }}
        >
          {category.lowStockCount} con stock bajo
        </span>
      )}
    </button>
  )
}

function CategoryChip({ label, active, index, onClick }: { label: string; active: boolean; index: number; onClick: () => void }) {
  const color = index < 0 ? 'var(--primary)' : categoryColor(index)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        height: 38,
        padding: '0 15px',
        borderRadius: 999,
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? color : 'var(--card)',
        color: active ? 'var(--neutral-0)' : 'var(--foreground)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? 'transparent' : color }} />
      <span>{label}</span>
    </button>
  )
}

function ViewTab({ active, icon, label, onClick }: { active: boolean; icon: 'grid' | 'list'; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontFamily: 'inherit',
        height: 34,
        padding: '0 15px',
        borderRadius: 9,
        border: 'none',
        background: active ? 'var(--card)' : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontSize: 12.5,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        boxShadow: active ? '0 1px 2px oklch(0.15 0.01 250 / 0.08)' : 'none',
      }}
    >
      <Icon name={icon} size={15} strokeWidth={1.9} />
      <span>{label}</span>
    </button>
  )
}

function Kbd({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ border: '1px solid var(--hairline)', borderRadius: 6, padding: '3px 7px', background: 'var(--card)', ...style }}>
      {children}
    </span>
  )
}

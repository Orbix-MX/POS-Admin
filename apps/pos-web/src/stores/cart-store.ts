import { create } from 'zustand'
import type { Cliente, Product } from '~/services/orbix'

/**
 * Carrito de la venta en curso. Es estado de cliente puro: nada de esto existe
 * en el servidor hasta que el cobro crea la orden.
 *
 * El descuento se guarda como monto sobre la venta y se reparte por línea al
 * enviar (ver `distributeOrderDiscount`), porque el contrato del backend solo
 * acepta descuento por renglón.
 */

export type CartLineType = 'PRODUCT' | 'SERVICE'

export interface CartLine {
  /** Clave estable de la línea dentro del carrito. */
  key: string
  productId: string
  type: CartLineType
  name: string
  sku: string
  unitPrice: number
  qty: number
  /** Existencia disponible; `Infinity` cuando el producto no lleva inventario. */
  stock: number
  /** Descuento asignado a esta línea (lo calcula el reparto, no se edita a mano). */
  discount?: number
}

export interface SuspendedSale {
  id: string
  label: string
  createdAt: string
  lines: CartLine[]
  customer: Cliente | null
  discount: number
}

const SUSPENDED_KEY = 'orbix_pos_suspended_sales'

function readSuspended(): SuspendedSale[] {
  try {
    const raw = localStorage.getItem(SUSPENDED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as SuspendedSale[]) : []
  } catch {
    return []
  }
}

function writeSuspended(sales: SuspendedSale[]) {
  try {
    localStorage.setItem(SUSPENDED_KEY, JSON.stringify(sales))
  } catch {
    // Cuota llena o almacenamiento bloqueado: la venta en curso no se pierde,
    // solo no queda suspendida. El llamador avisa al cajero.
  }
}

export interface AddResult {
  ok: boolean
  reason?: string
}

interface CartState {
  lines: CartLine[]
  customer: Cliente | null
  /** Descuento sobre la venta, en pesos. */
  discount: number
  suspended: SuspendedSale[]

  add: (product: Product) => AddResult
  setQty: (key: string, qty: number) => AddResult
  increment: (key: string) => AddResult
  decrement: (key: string) => void
  remove: (key: string) => void
  clear: () => void

  setCustomer: (customer: Cliente | null) => void
  setDiscount: (amount: number) => void

  suspend: (label: string) => boolean
  resume: (id: string) => void
  discard: (id: string) => void
}

const stockOf = (p: Product): number => (p.trackInventory ? Number(p.stock ?? 0) : Number.POSITIVE_INFINITY)

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],
  customer: null,
  discount: 0,
  suspended: readSuspended(),

  add: (product) => {
    if (!product.id) return { ok: false, reason: 'El producto no tiene identificador' }
    const stock = stockOf(product)
    const key = product.id
    const existing = get().lines.find((l) => l.key === key)

    if (existing) {
      if (existing.qty + 1 > stock) {
        return { ok: false, reason: `Stock máximo de "${product.name}" alcanzado (${stock} disponibles)` }
      }
      set({ lines: get().lines.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) })
      return { ok: true }
    }

    if (stock <= 0) return { ok: false, reason: `"${product.name}" sin stock disponible` }

    set({
      lines: [
        ...get().lines,
        {
          key,
          productId: product.id,
          type: 'PRODUCT',
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.price),
          qty: 1,
          stock,
        },
      ],
    })
    return { ok: true }
  },

  setQty: (key, qty) => {
    const line = get().lines.find((l) => l.key === key)
    if (!line) return { ok: false }
    if (qty <= 0) {
      set({ lines: get().lines.filter((l) => l.key !== key) })
      return { ok: true }
    }
    if (qty > line.stock) {
      return { ok: false, reason: `Stock máximo de "${line.name}" alcanzado (${line.stock} disponibles)` }
    }
    set({ lines: get().lines.map((l) => (l.key === key ? { ...l, qty } : l)) })
    return { ok: true }
  },

  increment: (key) => {
    const line = get().lines.find((l) => l.key === key)
    return line ? get().setQty(key, line.qty + 1) : { ok: false }
  },

  decrement: (key) => {
    const line = get().lines.find((l) => l.key === key)
    if (line) get().setQty(key, line.qty - 1)
  },

  remove: (key) => set({ lines: get().lines.filter((l) => l.key !== key) }),

  clear: () => set({ lines: [], customer: null, discount: 0 }),

  setCustomer: (customer) => set({ customer }),

  setDiscount: (amount) => set({ discount: Math.max(0, Math.round(amount * 100) / 100) }),

  suspend: (label) => {
    const { lines, customer, discount, suspended } = get()
    if (lines.length === 0) return false
    const sale: SuspendedSale = {
      id: `sus-${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
      lines,
      customer,
      discount,
    }
    const next = [sale, ...suspended]
    writeSuspended(next)
    set({ suspended: next, lines: [], customer: null, discount: 0 })
    return true
  },

  resume: (id) => {
    const sale = get().suspended.find((s) => s.id === id)
    if (!sale) return
    const next = get().suspended.filter((s) => s.id !== id)
    writeSuspended(next)
    set({ suspended: next, lines: sale.lines, customer: sale.customer, discount: sale.discount })
  },

  discard: (id) => {
    const next = get().suspended.filter((s) => s.id !== id)
    writeSuspended(next)
    set({ suspended: next })
  },
}))

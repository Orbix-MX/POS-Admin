import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Search, X, Loader2, Package, Minus, AlertCircle, Plus,
  ChevronDown, Building2,
} from 'lucide-react'
import { useProveedores } from '@/hooks/retail/use-proveedores'
import { useProducts, EMPTY_FORM as EMPTY_PRODUCT_FORM } from '@/hooks/retail/use-products'
import { useCategories } from '@/hooks/retail/use-categories'
import { ProductFormModal } from '@/components/inventario/product-form-modal'
import { createProduct } from '@/services/retail/product-service'
import { fmtMoney } from '@/services/retail/compras-service'
import type { ApiPurchaseOrder, OrderForm, OrderFormItem } from '@/hooks/retail/use-compras'
import type { Product } from '@/services/retail/product-service'

// ---- Props ----

export interface PurchaseFormProps {
  open: boolean
  onClose: () => void
  editing: ApiPurchaseOrder | null
  orderForm: OrderForm
  setOrderForm: React.Dispatch<React.SetStateAction<OrderForm>>
  saving: boolean
  formError: string | null
  onSave: () => void
}

// ---- Supplier combobox ----

function SupplierCombobox({
  value,
  onChange,
  proveedores,
  loading,
}: {
  value: string
  onChange: (id: string) => void
  proveedores: Array<{ id: string; nombre: string; email: string }>
  loading: boolean
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = proveedores.find(p => p.id === value)

  const results = useMemo(() => {
    if (!query.trim()) return proveedores.slice(0, 8)
    const lower = query.toLowerCase()
    return proveedores
      .filter(p =>
        p.nombre.toLowerCase().includes(lower) ||
        p.email.toLowerCase().includes(lower)
      )
      .slice(0, 8)
  }, [query, proveedores])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((id: string) => {
    onChange(id)
    setQuery('')
    setOpen(false)
  }, [onChange])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    // If the user clears the field, also clear the selection
    if (!e.target.value) onChange('')
    setOpen(true)
  }, [onChange])

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 border rounded-lg px-3 py-2 bg-card transition-colors ${open ? 'border-primary' : 'border-border'}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 animate-spin" />
        ) : (
          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
        <input
          value={open ? query : (selected?.nombre ?? '')}
          onChange={handleInputChange}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={loading ? 'Cargando proveedores…' : 'Buscar proveedor…'}
          disabled={loading}
          className="flex-1 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && !loading && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-muted-foreground text-center">
              No se encontraron proveedores
            </div>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(p.id) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left ${p.id === value ? 'bg-primary/5' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-foreground truncate">{p.nombre}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{p.email}</div>
                </div>
                {p.id === value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---- Product autocomplete ----

function ProductAutocomplete({
  products,
  loadingProducts,
  alreadyAdded,
  onSelect,
  onCreateNew,
}: {
  products: Product[]
  loadingProducts: boolean
  alreadyAdded: string[]
  onSelect: (p: Product) => void
  onCreateNew: () => void
}) {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    if (!q.trim()) return []
    const lower = q.toLowerCase()
    return products
      .filter(p =>
        !alreadyAdded.includes(p.id ?? '') &&
        (p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower))
      )
      .slice(0, 6)
  }, [q, products, alreadyAdded])

  const showEmpty = q.trim().length > 0 && results.length === 0 && !loadingProducts

  return (
    <div className="relative">
      <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-muted/30 focus-within:border-primary transition-colors">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={loadingProducts ? 'Cargando productos…' : 'Buscar producto por nombre o SKU…'}
          disabled={loadingProducts}
          className="flex-1 bg-transparent outline-none text-[13px] text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(results.length > 0 || showEmpty) && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setQ('') }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{p.sku}</div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.costPrice ? fmtMoney(p.costPrice) : '—'}
              </div>
            </button>
          ))}
          {showEmpty && (
            <div className="px-3 py-2.5 text-[12px] text-muted-foreground">
              No se encontró &quot;{q}&quot;
            </div>
          )}
          <button
            type="button"
            onClick={() => { onCreateNew(); setQ('') }}
            className="w-full flex items-center gap-2 px-3 py-2.5 border-t border-border hover:bg-muted/50 transition-colors text-left text-[12px] font-medium text-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            Crear producto nuevo
          </button>
        </div>
      )}
    </div>
  )
}

// ---- Main PurchaseForm ----

export function PurchaseForm({
  open,
  onClose,
  editing,
  orderForm,
  setOrderForm,
  saving,
  formError,
  onSave,
}: PurchaseFormProps) {
  // Catalogs
  const { proveedores, loading: loadingProveedores } = useProveedores()
  const {
    products,
    loading: loadingProducts,
    form: productForm,
    setForm: setProductForm,
    handleOpenNew: openProductModal,
    handleCloseModal: closeProductModal,
    modalOpen: productModalOpen,
    loadProducts,
  } = useProducts()
  const { categories } = useCategories()

  // Inline product creation state
  const [savingProduct, setSavingProduct] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  // ---- Item helpers ----
  const addItemToForm = useCallback((product: Product) => {
    setOrderForm(prev => {
      if (prev.items.find(i => i.productId === product.id)) return prev
      return {
        ...prev,
        items: [...prev.items, {
          productId: product.id!,
          productName: product.name,
          productSku: product.sku,
          quantityOrdered: 1,
          unitCost: product.costPrice ? parseFloat(String(product.costPrice)) : 0,
          tax: 0,
        }],
      }
    })
  }, [setOrderForm])

  const removeItemFromForm = useCallback((productId: string) => {
    setOrderForm(prev => ({ ...prev, items: prev.items.filter(i => i.productId !== productId) }))
  }, [setOrderForm])

  const updateItemInForm = useCallback((
    productId: string,
    field: keyof Omit<OrderFormItem, 'productId' | 'productName' | 'productSku'>,
    value: number,
  ) => {
    setOrderForm(prev => ({
      ...prev,
      items: prev.items.map(i => i.productId === productId ? { ...i, [field]: value } : i),
    }))
  }, [setOrderForm])

  // ---- Totals ----
  const totals = useMemo(() => {
    let subtotal = 0, tax = 0
    for (const i of orderForm.items) {
      subtotal += i.quantityOrdered * i.unitCost
      tax += i.tax
    }
    return { subtotal, tax, total: subtotal + tax }
  }, [orderForm.items])

  // ---- Inline product creation ----
  const handleCreateAndAdd = useCallback(async () => {
    setSavingProduct(true)
    setProductError(null)
    try {
      const created = await createProduct(productForm)
      if (created.id) {
        setOrderForm(prev => ({
          ...prev,
          items: prev.items.find(i => i.productId === created.id!)
            ? prev.items
            : [...prev.items, {
                productId: created.id!,
                productName: created.name,
                productSku: created.sku,
                quantityOrdered: 1,
                unitCost: created.costPrice ? parseFloat(String(created.costPrice)) : 0,
                tax: 0,
              }],
        }))
      }
      // Reset the product form for next use
      setProductForm(EMPTY_PRODUCT_FORM)
      await loadProducts()
      closeProductModal()
    } catch {
      setProductError('Error al crear el producto')
    } finally {
      setSavingProduct(false)
    }
  }, [productForm, loadProducts, closeProductModal, setOrderForm, setProductForm])

  if (!open) return null

  const alreadyAdded = orderForm.items.map(i => i.productId)

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                {editing ? `Editar orden ${editing.orderNumber}` : 'Nueva orden de compra'}
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {editing ? 'Solo disponible en estado Borrador' : 'Crea una nueva orden para un proveedor'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Supplier + date row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  Proveedor
                </label>
                <SupplierCombobox
                  value={orderForm.supplierId}
                  onChange={id => setOrderForm(prev => ({ ...prev, supplierId: id }))}
                  proveedores={proveedores}
                  loading={loadingProveedores}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  Fecha de entrega est.
                </label>
                <input
                  type="date"
                  value={orderForm.expectedDate}
                  onChange={e => setOrderForm(prev => ({ ...prev, expectedDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">Notas</label>
              <textarea
                value={orderForm.notes}
                onChange={e => setOrderForm(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                placeholder="Instrucciones especiales, referencia interna…"
                className="w-full px-3 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary transition-colors resize-none"
              />
            </div>

            {/* Products */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  Productos
                </label>
                <span className="text-[11px] text-muted-foreground">
                  {orderForm.items.length} producto{orderForm.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              <ProductAutocomplete
                products={products}
                loadingProducts={loadingProducts}
                alreadyAdded={alreadyAdded}
                onSelect={addItemToForm}
                onCreateNew={openProductModal}
              />

              {orderForm.items.length > 0 && (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Producto</th>
                        <th className="text-center px-2 py-2 font-medium text-muted-foreground w-20">Cantidad</th>
                        <th className="text-center px-2 py-2 font-medium text-muted-foreground w-24">Costo unit.</th>
                        <th className="text-center px-2 py-2 font-medium text-muted-foreground w-20">IVA</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground w-24">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {orderForm.items.map((item, idx) => (
                        <tr
                          key={item.productId}
                          className={`border-b border-border last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-foreground truncate max-w-[140px]">{item.productName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{item.productSku}</div>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min={1}
                              value={item.quantityOrdered}
                              onChange={e => updateItemInForm(item.productId, 'quantityOrdered', Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full text-center px-1.5 py-1 border border-border rounded-md bg-card text-[12px] outline-none focus:border-primary"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[11px]">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.unitCost}
                                onChange={e => updateItemInForm(item.productId, 'unitCost', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full text-right pl-4 pr-1.5 py-1 border border-border rounded-md bg-card text-[12px] outline-none focus:border-primary"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[11px]">$</span>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={item.tax}
                                onChange={e => updateItemInForm(item.productId, 'tax', Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-full text-right pl-4 pr-1.5 py-1 border border-border rounded-md bg-card text-[12px] outline-none focus:border-primary"
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-foreground tabular-nums">
                            {fmtMoney(item.quantityOrdered * item.unitCost + item.tax)}
                          </td>
                          <td className="pr-2 py-2">
                            <button
                              type="button"
                              onClick={() => removeItemFromForm(item.productId)}
                              className="p-1 rounded-md hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 text-muted-foreground transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {orderForm.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
                  <Package className="w-8 h-8 mb-2 opacity-40" />
                  <span className="text-[13px]">Busca y agrega productos arriba</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border px-5 py-4">
            {orderForm.items.length > 0 && (
              <div className="flex justify-end gap-6 mb-3 text-[12px]">
                <span className="text-muted-foreground">
                  Subtotal: <span className="text-foreground font-medium tabular-nums">{fmtMoney(totals.subtotal)}</span>
                </span>
                <span className="text-muted-foreground">
                  IVA: <span className="text-foreground font-medium tabular-nums">{fmtMoney(totals.tax)}</span>
                </span>
                <span className="text-muted-foreground font-semibold">
                  Total: <span className="text-primary font-bold text-[14px] tabular-nums">{fmtMoney(totals.total)}</span>
                </span>
              </div>
            )}

            {formError && (
              <div className="flex items-center gap-2 text-red-500 text-[12px] mb-3 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {formError}
              </div>
            )}

            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Guardar cambios' : 'Crear orden'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inline product creation modal */}
      <ProductFormModal
        open={productModalOpen}
        onClose={closeProductModal}
        editingId={null}
        form={productForm}
        setForm={setProductForm}
        onSave={handleCreateAndAdd}
        categories={categories}
      />
      {productError && (
        <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 text-red-500 text-[12px] bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/40 shadow-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {productError}
          <button type="button" onClick={() => setProductError(null)} className="ml-1 hover:text-red-700">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {savingProduct && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-2.5 shadow-lg pointer-events-auto">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-[13px] text-foreground">Creando producto…</span>
          </div>
        </div>
      )}
    </>
  )
}

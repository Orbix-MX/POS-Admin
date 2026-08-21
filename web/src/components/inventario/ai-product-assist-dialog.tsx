import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Sparkles, TriangleAlert, CircleCheck } from 'lucide-react'
import { getProductDraft, type ProductDraftResponse } from '@/services/retail/product-ai-service'

export interface AiProductAssistDialogProps {
  open: boolean
  onClose: () => void
  /** Aplica el borrador al formulario de producto y abre su modal de edición para revisión. */
  onUseDraft: (draft: ProductDraftResponse) => void
}

const EXAMPLE = 'Ej. "Quiero agregar Coca-Cola de 600 ml, me cuesta 15 pesos y la vendo en 22."'

const TAX_LABELS: Record<string, string> = {
  IVA_16: 'IVA 16%',
  IVA_11: 'IVA 11%',
  IVA_8: 'IVA 8%',
  EXCENTO: 'Exento',
}

export function AiProductAssistDialog({ open, onClose, onUseDraft }: AiProductAssistDialogProps) {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProductDraftResponse | null>(null)

  function reset() {
    setMessage('')
    setError(null)
    setDraft(null)
    setLoading(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleGenerate() {
    if (message.trim().length < 3) return
    setLoading(true)
    setError(null)
    setDraft(null)
    try {
      const result = await getProductDraft(message.trim())
      setDraft(result)
    } catch (e: any) {
      const apiMessage = e?.response?.data?.message
      setError(
        typeof apiMessage === 'string'
          ? apiMessage
          : 'No se pudo generar el borrador. Intenta de nuevo o captura el producto manualmente.',
      )
    } finally {
      setLoading(false)
    }
  }

  function handleUseDraft() {
    if (!draft) return
    onUseDraft(draft)
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[520px] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Alta de producto con IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Describe el producto como se lo dirías a un compañero
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={EXAMPLE}
              rows={3}
              disabled={loading}
              className="w-full px-3 py-2 border border-border rounded-lg text-[13px] bg-card outline-none focus:border-primary resize-none disabled:opacity-60"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              La IA propone un borrador — tú revisas y confirmas antes de crear nada.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
              <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {draft && (
            <div className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Borrador propuesto
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Confianza: {Math.round(draft.confidence * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                <div className="col-span-2">
                  <span className="text-muted-foreground text-[11px]">Nombre</span>
                  <p className="font-medium">{draft.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Precio</span>
                  <p className="font-medium">${draft.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Costo</span>
                  <p className="font-medium">
                    {draft.costPrice != null
                      ? `$${draft.costPrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                      : '— (no mencionado)'}
                  </p>
                </div>
                {draft.comparePrice != null && (
                  <div>
                    <span className="text-muted-foreground text-[11px]">Precio antes</span>
                    <p className="font-medium">${draft.comparePrice.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-[11px]">Categoría</span>
                  <p className="font-medium flex items-center gap-1">
                    {draft.category.name}
                    {!draft.category.id && (
                      <span title="No existe en tu catálogo — se creará o deberás elegir otra al confirmar">
                        <TriangleAlert className="w-3 h-3 text-amber-500" />
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px]">Impuesto</span>
                  <p className="font-medium">{TAX_LABELS[draft.taxCode] ?? draft.taxCode}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground text-[11px]">SKU sugerido</span>
                  <p className="font-medium font-mono text-[12px]">{draft.skuSuggestion}</p>
                </div>
              </div>

              {draft.conflicts.includes('price_below_cost') && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>El precio es menor al costo. Revísalo antes de guardar.</span>
                </div>
              )}

              {draft.conflicts.includes('compare_price_not_higher') && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>El precio antes no es mayor al precio actual. Revísalo antes de guardar.</span>
                </div>
              )}

              {draft.unresolved.includes('categoryName') && (
                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                  <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>&quot;{draft.category.name}&quot; no existe en tu catálogo. Elige una categoría al confirmar.</span>
                </div>
              )}

              {draft.conflicts.length === 0 && draft.unresolved.length === 0 && (
                <div className="flex items-center gap-2 text-[11px] text-green-700 dark:text-green-400">
                  <CircleCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Todo listo para revisar en el formulario.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2.5 justify-end pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 border border-border rounded-lg bg-card text-[13px] cursor-pointer text-muted-foreground"
          >
            Cancelar
          </button>
          {!draft ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || message.trim().length < 3}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loading ? 'Generando…' : 'Generar borrador'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUseDraft}
              className="px-4 py-2 bg-primary text-primary-foreground border-none rounded-lg text-[13px] font-semibold cursor-pointer"
            >
              Revisar y completar
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { Dialog } from '~/components/ui/Dialog'
import { Button } from '~/components/ui/Button'
import { EmptyState } from '~/components/shared/StateBlock'
import { Icon } from '~/components/shared/Icon'
import { useCartStore } from '~/stores/cart-store'
import { money } from '~/utils/money'

/**
 * Ventas suspendidas.
 *
 * Viven en `localStorage` del equipo, no en el servidor: el backend no tiene un
 * concepto de venta en espera para retail (las órdenes `PENDING`/`LAYAWAY` son
 * otra cosa — ya están registradas). Por eso una venta suspendida solo se puede
 * retomar en la misma terminal. Ver BACKEND-GAPS.md, «Ventas suspendidas».
 */
export function SuspendedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const suspended = useCartStore((s) => s.suspended)
  const lines = useCartStore((s) => s.lines)
  const resume = useCartStore((s) => s.resume)
  const discard = useCartStore((s) => s.discard)

  const hasCurrent = lines.length > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      width="min(560px, calc(100% - 32px))"
      title="Ventas suspendidas"
      description="Guardadas en esta terminal. Retomar una reemplaza la venta en curso."
    >
      {suspended.length === 0 ? (
        <EmptyState
          minHeight={160}
          icon={<Icon name="receipt" size={22} color="var(--muted-foreground)" />}
          title="No hay ventas suspendidas"
          message="Usa «Suspender» para dejar una venta en espera y atender a otro cliente."
        />
      ) : (
        <div className="pos-scroll" style={{ maxHeight: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suspended.map((sale) => {
            const total = sale.lines.reduce((acc, l) => acc + l.unitPrice * l.qty, 0)
            return (
              <div
                key={sale.id}
                style={{
                  border: '1px solid var(--hairline)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{sale.label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                    {sale.lines.length} {sale.lines.length === 1 ? 'línea' : 'líneas'} ·{' '}
                    {sale.customer?.nombre ?? 'Mostrador'} ·{' '}
                    {new Date(sale.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span className="tabular" style={{ fontSize: 14.5, fontWeight: 700 }}>
                  {money(total)}
                </span>
                <Button
                  size="sm"
                  style={{ height: 34 }}
                  onClick={() => {
                    resume(sale.id)
                    onClose()
                  }}
                >
                  Retomar
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Descartar" onClick={() => discard(sale.id)}>
                  ×
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {hasCurrent && suspended.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
          Tienes una venta en curso: suspéndela antes de retomar otra para no perderla.
        </div>
      )}
    </Dialog>
  )
}

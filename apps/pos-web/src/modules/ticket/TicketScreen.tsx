import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrderById, printOrder, customerName, type ApiOrder } from '~/services/orbix'
import { useAuthStore } from '~/stores/session-store'
import { fetchTenantInfo, type TenantInfo } from '~/services/orbix'
import { Button } from '~/components/ui/Button'
import { ErrorState, LoadingState, Spinner } from '~/components/shared/StateBlock'
import { errorMessage } from '~/utils/api-error'
import { money } from '~/utils/money'

/**
 * Comprobante de la venta.
 *
 * Todos los importes salen de la orden que devolvió el backend — no se
 * recalcula nada aquí. Es la fuente de verdad del cobro.
 */
export function TicketScreen() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const branch = useAuthStore((s) => s.currentBranch)
  const userName = useAuthStore((s) => s.user?.firstName ?? '')

  const [order, setOrder] = useState<ApiOrder | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)

  const load = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const [o, t] = await Promise.all([getOrderById(orderId), fetchTenantInfo().catch(() => null)])
      setOrder(o)
      setTenant(t)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const newSale = useCallback(() => navigate('/pos', { replace: true }), [navigate])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        newSale()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [newSale])

  if (loading) return <LoadingState label="Cargando el comprobante…" minHeight="100vh" />
  if (error || !order) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40 }}>
        <ErrorState
          title="No se pudo cargar el comprobante"
          message={error ?? 'La venta no está disponible.'}
          onRetry={load}
        />
      </div>
    )
  }

  const paid = Number(order.total)
  const change = order.payments.find((p) => p.paymentConcept === 'CHANGE')
  const methodLabel = paymentLabel(order)
  const createdAt = new Date(order.createdAt).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const onPrint = async () => {
    setPrinting(true)
    try {
      await printOrder(order.id)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 40, background: 'var(--neutral-0)' }}>
      <div style={{ width: 'min(1000px, 100%)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 22, alignItems: 'start' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 18, padding: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--semantic-green-bg)', display: 'grid', placeItems: 'center' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--semantic-green-fg)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Venta completada</div>
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                Ticket {order.orderNumber} · {createdAt} · {branch?.name ?? '—'}
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              background: 'var(--hairline)',
              border: '1px solid var(--hairline)',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 26,
            }}
          >
            <SummaryCell label="Total cobrado" value={money(paid)} big />
            <SummaryCell label="Método" value={methodLabel} />
            <SummaryCell label="Cambio entregado" value={money(change ? Number(change.amount) : 0)} big />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Button variant="outline" size="lg" block style={{ height: 44 }} disabled={printing} onClick={() => void onPrint()}>
              {printing ? <Spinner size={16} /> : 'Imprimir ticket'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              block
              style={{ height: 44 }}
              disabled
              title="El backend actual no expone envío de comprobante por WhatsApp"
            >
              Enviar por WhatsApp
            </Button>
          </div>

          <button
            type="button"
            onClick={newSale}
            style={{
              height: 70,
              width: '100%',
              cursor: 'pointer',
              border: 'none',
              borderRadius: 13,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontFamily: 'inherit',
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '0.04em',
              boxShadow: '0 4px 12px oklch(0.52 0.18 250 / 0.28)',
            }}
          >
            NUEVA VENTA
          </button>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
            Enter para iniciar otra venta · Esc para volver al POS
          </div>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '22px 20px' }}>
          <div style={{ textAlign: 'center', paddingBottom: 14, borderBottom: '1px dashed var(--border)' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{tenant?.displayName ?? tenant?.name ?? 'Orbix'}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)', marginTop: 2 }}>
              {[branch?.name, tenant?.rfc && `RFC ${tenant.rfc}`].filter(Boolean).join(' · ')}
            </div>
          </div>

          <div className="pos-scroll" style={{ padding: '14px 0', borderBottom: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 260 }}>
            {order.items.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
                <span style={{ color: 'var(--muted-foreground)' }}>
                  {item.quantity} × {item.name}
                </span>
                <span className="tabular" style={{ fontWeight: 600 }}>
                  {money(Number(item.total))}
                </span>
              </div>
            ))}
          </div>

          <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 7, fontSize: 12 }}>
            <TicketRow label="Subtotal" value={money(Number(order.subtotal))} />
            {Number(order.discount) > 0 && <TicketRow label="Descuento" value={`− ${money(Number(order.discount))}`} />}
            <TicketRow label="Impuestos" value={money(Number(order.tax))} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid var(--hairline)', paddingTop: 9, marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>TOTAL</span>
              <span className="tabular" style={{ fontSize: 19, fontWeight: 800 }}>
                {money(paid)}
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted-foreground)', borderTop: '1px dashed var(--border)', paddingTop: 12 }}>
            {customerName(order.customer)} · Atendió {userName || '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CREDITO: 'Crédito',
}

function paymentLabel(order: ApiOrder): string {
  const methods = [...new Set(order.payments.filter((p) => p.paymentConcept !== 'CHANGE').map((p) => p.paymentMethod))]
  if (methods.length === 0) return '—'
  if (methods.length > 1) return 'Pago mixto'
  return METHOD_LABELS[methods[0]] ?? methods[0]
}

function SummaryCell({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ background: 'var(--card)', padding: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: 4 }}>{label}</div>
      <div className={big ? 'tabular' : undefined} style={{ fontSize: big ? 22 : 16, fontWeight: big ? 800 : 700 }}>
        {value}
      </div>
    </div>
  )
}

function TicketRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--muted-foreground)' }}>{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

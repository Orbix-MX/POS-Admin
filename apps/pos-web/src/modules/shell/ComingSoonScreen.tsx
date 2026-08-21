import { useNavigate } from 'react-router-dom'
import { PosTopbar } from '~/modules/pos/components/PosTopbar'
import { PosNav } from '~/modules/pos/components/PosNav'
import { Button } from '~/components/ui/Button'
import { Icon } from '~/components/shared/Icon'
import { useCartStore } from '~/stores/cart-store'

/**
 * Secciones del menú lateral sin pantalla diseñada todavía.
 *
 * El diseño de referencia solo cubre el flujo de venta (login → selección →
 * apertura → POS → cobro → ticket). El resto se declara pendiente en vez de
 * inventarse: mientras tanto esas operaciones se hacen desde el Admin Web.
 */

const TITLES: Record<string, { title: string; detail: string }> = {
  inicio: { title: 'Inicio', detail: 'El resumen del turno llegará en una próxima entrega.' },
  caja: { title: 'Caja', detail: 'Movimientos, arqueo y corte se operan hoy desde el Admin Web.' },
  tickets: { title: 'Tickets', detail: 'El historial de ventas y las devoluciones se consultan hoy desde el Admin Web.' },
  productos: { title: 'Productos', detail: 'El catálogo se administra desde el Admin Web; aquí solo se vende.' },
  clientes: { title: 'Clientes', detail: 'Puedes crear y asignar clientes durante la venta desde el panel derecho del POS.' },
  reportes: { title: 'Reportes', detail: 'Los reportes viven hoy en el Admin Web.' },
}

export function ComingSoonScreen({ section }: { section: string }) {
  const navigate = useNavigate()
  const suspendedCount = useCartStore((s) => s.suspended.length)
  const info = TITLES[section] ?? { title: 'Sección', detail: 'Aún no disponible en Orbix POS.' }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PosTopbar suspendedCount={suspendedCount} onOpenSuspended={() => navigate('/pos')} onOpenCash={() => navigate('/caja')} />
      <div className="pos-layout">
        <PosNav />
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 40 }}>
          <div style={{ textAlign: 'center', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
              <Icon name="box" size={26} color="var(--muted-foreground)" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{info.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--muted-foreground)' }}>{info.detail}</div>
            <Button size="lg" style={{ height: 42, marginTop: 6 }} onClick={() => navigate('/pos')}>
              Volver a la venta
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

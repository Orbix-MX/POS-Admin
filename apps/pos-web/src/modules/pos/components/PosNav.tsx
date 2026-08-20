import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '~/components/shared/Icon'

/**
 * Menú lateral del POS. Solo «Venta» tiene pantalla en esta entrega; el resto
 * navega a un placeholder explícito en lugar de fingir estar disponible.
 */
const NAV: { key: string; label: string; icon: IconName; path: string }[] = [
  { key: 'inicio', label: 'Inicio', icon: 'home', path: '/inicio' },
  { key: 'venta', label: 'Venta', icon: 'cart', path: '/pos' },
  { key: 'caja', label: 'Caja', icon: 'cash', path: '/caja' },
  { key: 'tickets', label: 'Tickets', icon: 'receipt', path: '/tickets' },
  { key: 'productos', label: 'Productos', icon: 'box', path: '/productos' },
  { key: 'clientes', label: 'Clientes', icon: 'users', path: '/clientes' },
  { key: 'reportes', label: 'Reportes', icon: 'chart', path: '/reportes' },
]

export function PosNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Secciones"
      className="pos-nav pos-scroll"
    >
      {NAV.map((item) => {
        const active = pathname === item.path
        return (
          <button
            key={item.key}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path)}
            style={{
              cursor: 'pointer',
              border: 'none',
              background: active ? 'var(--primary)' : 'transparent',
              color: active ? 'var(--neutral-0)' : 'var(--neutral-400)',
              borderRadius: 12,
              padding: '11px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'inherit',
              minHeight: 60,
              transition: 'background .12s ease, color .12s ease',
            }}
          >
            <Icon name={item.icon} size={21} strokeWidth={1.8} />
            <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.01em' }}>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

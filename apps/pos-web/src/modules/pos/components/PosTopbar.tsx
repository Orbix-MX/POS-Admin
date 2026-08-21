import { useAuthStore } from '~/stores/session-store'
import { useCashStore, expectedCash } from '~/stores/cash-store'
import { useNetworkStatus } from '~/app/providers/NetworkStatusProvider'
import { BrandLockup } from '~/components/shared/Brand'
import { money } from '~/utils/money'
import { useState } from 'react'
import { CashRegisterPicker } from '~/modules/cash/CashRegisterPicker'
import { UserMenu } from './UserMenu'

/**
 * Barra superior: identifica en todo momento empresa, sucursal, caja y usuario,
 * como pide el diseño. Los importes de caja son los que reporta el backend.
 */
export function PosTopbar({
  suspendedCount,
  onOpenSuspended,
  onOpenCash,
}: {
  suspendedCount: number
  onOpenSuspended: () => void
  onOpenCash: () => void
}) {
  const branch = useAuthStore((s) => s.currentBranch)
  const session = useCashStore((s) => s.session)
  const registerName = useCashStore((s) => s.registerName)
  const [pickerOpen, setPickerOpen] = useState(false)
  const { online } = useNetworkStatus()

  const expected = expectedCash(session)

  return (
    <header
      style={{
        height: 56,
        flex: '0 0 56px',
        background: 'var(--card)',
        borderBottom: '1px solid var(--hairline)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 18px',
      }}
    >
      <BrandLockup size="sm" />
      <div style={{ height: 22, width: 1, background: 'var(--border)' }} />

      {/* El chip abre el selector: la caja es del puesto, y un relevo que llega
          en otro equipo necesita apuntar a la que le toca sin cerrar el turno. */}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        title="Cambiar de caja"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--brand-blue-50)',
          border: '1px solid var(--brand-blue-100)',
          borderRadius: 999,
          padding: '5px 12px',
          minWidth: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-blue-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {branch?.name ?? '—'}
        </span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--brand-blue-300)', flex: '0 0 auto' }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-blue-700)', whiteSpace: 'nowrap' }}>
          {registerName ?? (session?.status === 'ABIERTA' ? 'Caja abierta' : 'Caja')}
        </span>
      </button>

      <CashRegisterPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />

      <div
        title={online ? 'Conectado al servidor' : 'Sin conexión: no se pueden registrar ventas'}
        style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--hairline)', borderRadius: 999, padding: '5px 12px' }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: online ? 'var(--semantic-green-fg)' : 'var(--semantic-red-fg)',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)' }}>{online ? 'En línea' : 'Sin conexión'}</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <TopbarButton onClick={onOpenSuspended}>Suspendidas · {suspendedCount}</TopbarButton>
        <TopbarButton onClick={onOpenCash}>
          {expected != null ? `Efectivo esperado · ${money(expected)}` : 'Caja abierta'}
        </TopbarButton>
        <UserMenu />
      </div>
    </header>
  )
}

function TopbarButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        background: 'transparent',
        border: '1px solid var(--hairline)',
        borderRadius: 10,
        height: 34,
        padding: '0 12px',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--muted-foreground)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

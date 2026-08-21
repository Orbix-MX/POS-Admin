import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useDisplayName } from '~/stores/session-store'
import { useCashStore } from '~/stores/cash-store'
import { fetchActiveCashSession, type ApiCashSession, type Branch } from '~/services/orbix'
import { Button } from '~/components/ui/Button'
import { ErrorState, LoadingState, Spinner } from '~/components/shared/StateBlock'
import { errorMessage } from '~/utils/api-error'
import { money } from '~/utils/money'

/**
 * Paso 2 de 3: dónde se va a operar.
 *
 * El diseño plantea elegir "Sucursal" y luego "Caja". El backend de Orbix no
 * tiene entidad de caja/terminal: la caja **es** la sesión de efectivo abierta
 * en una sucursal (`/cash-sessions`, una activa por sucursal). Por eso el
 * segundo bloque no ofrece cajas a elegir, sino que muestra el estado real de
 * la caja de la sucursal seleccionada — ver BACKEND-GAPS.md, «Selección de caja».
 */
export function SelectContextScreen() {
  const navigate = useNavigate()
  const { availableBranches, currentBranch, confirmBranch, logout, loading } = useAuthStore()
  const displayName = useDisplayName()
  const role = useAuthStore((s) => s.user?.role ?? '')
  const refreshCash = useCashStore((s) => s.refresh)

  const [selectedId, setSelectedId] = useState<string | null>(currentBranch?.id ?? null)
  const [sessions, setSessions] = useState<Record<string, ApiCashSession | null>>({})
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [continuing, setContinuing] = useState(false)

  const branches = useMemo<Branch[]>(() => availableBranches ?? [], [availableBranches])

  const loadSessions = useCallback(async () => {
    if (branches.length === 0) {
      setSessionsLoading(false)
      return
    }
    setSessionsLoading(true)
    setError(null)
    try {
      const entries = await Promise.all(
        branches.map(async (b) => [b.id, await fetchActiveCashSession(b.id).catch(() => null)] as const),
      )
      setSessions(Object.fromEntries(entries))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSessionsLoading(false)
    }
  }, [branches])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!selectedId && branches.length > 0) setSelectedId(branches[0].id)
  }, [branches, selectedId])

  const selectedBranch = branches.find((b) => b.id === selectedId) ?? null
  const selectedSession = selectedId ? (sessions[selectedId] ?? null) : null

  const onContinue = async () => {
    if (!selectedId) return
    setContinuing(true)
    setError(null)
    try {
      if (currentBranch?.id !== selectedId) await confirmBranch(selectedId)
      const session = await refreshCash(selectedId)
      navigate(session?.status === 'ABIERTA' ? '/pos' : '/caja/apertura', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setContinuing(false)
    }
  }

  if (availableBranches === null) return <LoadingState label="Cargando sucursales…" minHeight="100vh" />

  if (branches.length === 0) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 48 }}>
        <ErrorState
          title="Sin sucursales activas"
          message="Tu usuario no tiene ninguna sucursal activa asignada. Pídele a un administrador que te asigne una desde el Admin Web."
          onRetry={() => void logout()}
        />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 48 }}>
      <div style={{ width: 'min(900px, 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <img src="/logo.svg" alt="" width={26} height={26} style={{ objectFit: 'contain' }} />
          <span style={{ fontSize: 22, fontWeight: 700 }}>Selecciona dónde vas a operar</span>
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--muted-foreground)', marginBottom: 28 }}>
          {displayName}
          {role ? ` · ${role}` : ''}
        </div>

        <SectionLabel>Sucursal</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 32 }}>
          {branches.map((b) => {
            const on = b.id === selectedId
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                style={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  background: 'var(--card)',
                  border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  fontFamily: 'inherit',
                  boxShadow: on ? '0 0 0 3px oklch(0.52 0.18 250 / 0.15)' : 'none',
                }}
              >
                <span style={{ fontSize: 15.5, fontWeight: 700 }}>{b.name}</span>
                <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
                  {[b.address, b.city].filter(Boolean).join(', ') || b.code}
                </span>
              </button>
            )
          })}
        </div>

        <SectionLabel>Caja</SectionLabel>
        <div style={{ marginBottom: 32 }}>
          {sessionsLoading ? (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--card)',
              }}
            >
              <Spinner size={16} />
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Consultando el estado de la caja…</span>
            </div>
          ) : (
            <CashStatusCard session={selectedSession} branchName={selectedBranch?.name ?? ''} />
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 20,
              background: 'var(--semantic-red-bg)',
              color: 'var(--semantic-red-fg)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            borderTop: '1px solid var(--hairline)',
            paddingTop: 20,
          }}
        >
          <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
            Operarás en <strong style={{ color: 'var(--foreground)' }}>{selectedBranch?.name ?? '—'}</strong>
            {selectedSession ? (
              <>
                {' · '}
                <strong style={{ color: 'var(--foreground)' }}>caja abierta</strong>
              </>
            ) : (
              <>
                {' · '}
                <strong style={{ color: 'var(--foreground)' }}>sin caja abierta</strong>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="outline" size="lg" style={{ height: 40 }} onClick={() => void logout()}>
              Cerrar sesión
            </Button>
            <Button size="lg" style={{ height: 44, paddingInline: 22, fontSize: 14, fontWeight: 700 }} disabled={!selectedId || continuing || loading} onClick={() => void onContinue()}>
              {continuing ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Continuar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--muted-foreground)',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function CashStatusCard({ session, branchName }: { session: ApiCashSession | null; branchName: string }) {
  const open = session?.status === 'ABIERTA'
  const counting = session?.status === 'EN_ARQUEO'

  const label = open ? 'Abierta' : counting ? 'En arqueo' : 'Sin abrir'
  const bg = open ? 'var(--semantic-green-bg)' : counting ? 'var(--semantic-yellow-bg)' : 'var(--semantic-gray-bg)'
  const fg = open ? 'var(--semantic-green-fg)' : counting ? 'var(--semantic-yellow-fg)' : 'var(--semantic-gray-fg)'

  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 420,
      }}
    >
      <span style={{ fontSize: 15.5, fontWeight: 700 }}>Caja de {branchName || 'la sucursal'}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: fg, background: bg, padding: '3px 9px', borderRadius: 999, alignSelf: 'flex-start' }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
        {session
          ? `Fondo inicial ${money(Number(session.openingAmount ?? 0))} · abierta por ${session.openedBy?.email ?? '—'}`
          : 'Al continuar registrarás el fondo inicial del turno.'}
      </span>
    </div>
  )
}

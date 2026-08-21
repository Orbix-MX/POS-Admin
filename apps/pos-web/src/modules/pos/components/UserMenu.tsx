import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, useInitials, useShortName } from '~/stores/session-store'
import { useCashStore } from '~/stores/cash-store'

/**
 * Menú de usuario de la barra superior.
 *
 * Antes este bloque era decorativo —iniciales y nombre, sin acciones—, así que
 * cerrar sesión desde el POS obligaba a escribir `/seleccionar` a mano. En un
 * relevo de turno eso significaba que el cajero entrante no tenía forma de sacar
 * al saliente.
 *
 * Cerrar sesión **no** olvida la caja de la terminal: la caja es del puesto, y
 * el turno siguiente debe encontrarla tal cual la dejó el anterior.
 */
export function UserMenu() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const role = useAuthStore((s) => s.user?.role ?? '')
  const email = useAuthStore((s) => s.user?.email ?? '')
  const branch = useAuthStore((s) => s.currentBranch)
  const resetCash = useCashStore((s) => s.reset)
  const initials = useInitials()
  const shortName = useShortName()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onLogout = async () => {
    setOpen(false)
    // La caja del store se limpia para que el siguiente usuario no vea el
    // efectivo del turno anterior antes de que el backend responda. La caja
    // *de la terminal* (localStorage) se conserva a propósito.
    resetCash()
    await logout()
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Cuenta y sesión"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          paddingLeft: 6,
          paddingRight: 8,
          height: 40,
          background: open ? 'var(--secondary)' : 'transparent',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'var(--secondary)',
            color: 'var(--brand-blue-700)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {initials}
        </div>
        <div style={{ lineHeight: 1.15, textAlign: 'left' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{shortName}</div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{role}</div>
        </div>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 46,
            right: 0,
            minWidth: 240,
            background: 'var(--card)',
            border: '1px solid var(--hairline)',
            borderRadius: 14,
            boxShadow: '0 12px 28px oklch(0.15 0.01 250 / 0.14)',
            padding: 8,
            zIndex: 60,
          }}
        >
          <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--hairline)', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, wordBreak: 'break-all' }}>{email || shortName}</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
              {branch?.name ?? 'Sin sucursal'}
            </div>
          </div>

          <MenuItem
            onClick={() => {
              setOpen(false)
              navigate('/seleccionar')
            }}
          >
            Cambiar de sucursal
          </MenuItem>

          <MenuItem danger onClick={() => void onLogout()}>
            Cerrar sesión
          </MenuItem>
        </div>
      )}
    </div>
  )
}

function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode
  onClick: () => void
  danger?: boolean
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '10px 10px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 600,
        background: hover ? 'var(--secondary)' : 'transparent',
        color: danger ? 'var(--semantic-red-fg)' : 'var(--foreground)',
      }}
    >
      {children}
    </button>
  )
}

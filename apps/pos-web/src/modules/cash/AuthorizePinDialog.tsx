import { useEffect, useState } from 'react'
import { Dialog } from '~/components/ui/Dialog'
import { Button } from '~/components/ui/Button'
import { Input } from '~/components/ui/Input'
import { Spinner } from '~/components/shared/StateBlock'

/**
 * Autorización de supervisor en la terminal.
 *
 * Se pide solo cuando el usuario de la sesión no tiene el permiso; con permiso
 * propio la operación no pasa por aquí. El PIN es el mismo que el admin
 * configura para el empleado, y se manda al servidor sin guardarse ni mostrarse:
 * el cajero nunca conoce credenciales de nadie.
 *
 * El servidor vuelve a validar permiso y PIN — esta pantalla solo recoge el
 * dato, no decide.
 */
export function AuthorizePinDialog({
  open,
  title,
  action,
  working,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  /** Qué se va a autorizar, en una línea legible para quien teclea el PIN. */
  action: string
  working: boolean
  error: string | null
  onClose: () => void
  onConfirm: (pin: string) => void
}) {
  const [pin, setPin] = useState('')

  // El PIN no sobrevive al cierre del diálogo: ni se reutiliza en la siguiente
  // operación ni queda en memoria del formulario.
  useEffect(() => {
    if (!open) setPin('')
  }, [open])

  // Tras un PIN rechazado el campo se vacía: quien reintenta teclea de nuevo en
  // vez de tener que borrar los dígitos del intento anterior.
  useEffect(() => {
    if (error) setPin('')
  }, [error])

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={`${action} requiere la autorización de un supervisor. Pide que teclee su PIN.`}
      width="380px"
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-foreground)', marginBottom: 6 }}>
        PIN del supervisor
      </div>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && pin.length >= 4 && !working) onConfirm(pin)
        }}
        placeholder="••••"
        style={{ height: 46, fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }}
      />

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            background: 'var(--semantic-red-bg)',
            color: 'var(--semantic-red-fg)',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
        <Button variant="secondary" onClick={onClose} disabled={working}>
          Cancelar
        </Button>
        <Button disabled={working || pin.length < 4} onClick={() => onConfirm(pin)}>
          {working ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Autorizar'}
        </Button>
      </div>
    </Dialog>
  )
}

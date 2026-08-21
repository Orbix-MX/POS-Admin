import { useState, type FormEvent } from 'react'
import { Dialog } from '~/components/ui/Dialog'
import { Button } from '~/components/ui/Button'
import { Input } from '~/components/ui/Input'
import { EmptyState, ErrorState, LoadingState, Spinner } from '~/components/shared/StateBlock'
import { Icon } from '~/components/shared/Icon'
import { useCustomers } from '~/hooks/use-customers'
import type { Cliente } from '~/services/orbix'

/**
 * Selección y alta rápida de cliente sin salir de la venta.
 *
 * El alta usa `POST /customers` (el mismo del Admin Web). Al crear, el cliente
 * queda seleccionado de inmediato y el carrito no se toca.
 */
export function CustomerDialog({
  open,
  onClose,
  onSelect,
  current,
}: {
  open: boolean
  onClose: () => void
  onSelect: (customer: Cliente | null) => void
  current: Cliente | null
}) {
  const { filtered, query, setQuery, loading, error, reload, create, creating, createError, clearCreateError } = useCustomers()
  const [mode, setMode] = useState<'list' | 'create'>('list')

  const close = () => {
    setMode('list')
    setQuery('')
    clearCreateError()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      width="min(560px, calc(100% - 32px))"
      title={mode === 'list' ? 'Cliente de la venta' : 'Nuevo cliente'}
      description={
        mode === 'list'
          ? 'Asigna un cliente registrado o crea uno sin perder el carrito.'
          : 'Se dará de alta en el catálogo de clientes de Orbix.'
      }
    >
      {mode === 'list' ? (
        <>
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, correo o teléfono"
            aria-label="Buscar cliente"
            style={{ height: 40, fontSize: 14 }}
          />

          <div className="pos-scroll" style={{ maxHeight: 320, minHeight: 160, margin: '0 -4px' }}>
            {loading ? (
              <LoadingState label="Cargando clientes…" minHeight={160} />
            ) : error ? (
              <ErrorState message={error} onRetry={reload} minHeight={160} />
            ) : filtered.length === 0 ? (
              <EmptyState
                minHeight={160}
                icon={<Icon name="users" size={22} color="var(--muted-foreground)" />}
                title="Sin coincidencias"
                message="Crea el cliente para asignarlo a esta venta."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
                {current && (
                  <CustomerRow
                    name="Venta de mostrador"
                    detail="Sin cliente asignado"
                    active={false}
                    onClick={() => {
                      onSelect(null)
                      close()
                    }}
                  />
                )}
                {filtered.map((c) => (
                  <CustomerRow
                    key={c.id}
                    name={c.nombre}
                    detail={[c.email, c.telefono].filter(Boolean).join(' · ') || 'Cliente registrado'}
                    active={current?.id === c.id}
                    onClick={() => {
                      onSelect(c)
                      close()
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" block style={{ height: 42 }} onClick={() => setMode('create')}>
            + Crear cliente nuevo
          </Button>
        </>
      ) : (
        <CreateCustomerForm
          creating={creating}
          error={createError}
          onCancel={() => {
            clearCreateError()
            setMode('list')
          }}
          onSubmit={async (input) => {
            const created = await create(input)
            if (created) {
              onSelect(created)
              close()
            }
          }}
        />
      )}
    </Dialog>
  )
}

function CustomerRow({ name, detail, active, onClick }: { name: string; detail: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        border: `1px solid ${active ? 'var(--primary)' : 'transparent'}`,
        background: active ? 'var(--brand-blue-50)' : 'transparent',
        borderRadius: 10,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</span>
      <span style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>{detail}</span>
    </button>
  )
}

interface NewCustomer {
  firstName: string
  lastName: string
  email: string
  phone: string
}

function CreateCustomerForm({
  creating,
  error,
  onCancel,
  onSubmit,
}: {
  creating: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: NewCustomer) => void | Promise<void>
}) {
  const [form, setForm] = useState<NewCustomer>({ firstName: '', lastName: '', email: '', phone: '' })

  const valid = form.firstName.trim() !== '' && form.email.trim() !== ''

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!valid || creating) return
    void onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <LabeledInput label="Nombre" required value={form.firstName} onChange={(v) => setForm((p) => ({ ...p, firstName: v }))} autoFocus />
        <LabeledInput label="Apellido" value={form.lastName} onChange={(v) => setForm((p) => ({ ...p, lastName: v }))} />
      </div>
      <LabeledInput label="Correo" required type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} />
      <LabeledInput label="Teléfono" type="tel" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />

      {error && (
        <div
          role="alert"
          style={{ background: 'var(--semantic-red-bg)', color: 'var(--semantic-red-fg)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, fontWeight: 600 }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <Button type="button" variant="ghost" block style={{ height: 42 }} onClick={onCancel}>
          Regresar
        </Button>
        <Button type="submit" block style={{ height: 42, fontWeight: 700 }} disabled={!valid || creating}>
          {creating ? <Spinner size={16} color="var(--primary-foreground)" /> : 'Crear y asignar'}
        </Button>
      </div>
    </form>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  required,
  type = 'text',
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  autoFocus?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted-foreground)' }}>
        {label}
        {required && <span style={{ color: 'var(--semantic-red-fg)' }}> *</span>}
      </span>
      <Input type={type} value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} style={{ height: 40, fontSize: 14 }} />
    </label>
  )
}

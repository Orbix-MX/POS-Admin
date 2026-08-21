import { useMemo, useState } from 'react'
import { Loader2, Plus, Monitor, Check, X, Pencil } from 'lucide-react'
import { useCashRegisters } from '@/hooks/core/use-cash-registers'
import type { CashRegister } from '@/services/core/caja-service'

const STATE_LABEL: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_ARQUEO: 'En arqueo',
  PENDIENTE_AUTORIZACION: 'Pendiente de autorizar',
}

/**
 * Alta y mantenimiento de las cajas físicas de la sucursal.
 *
 * Hasta ahora las cajas solo nacían solas —la primera apertura creaba "Caja 1"—
 * y no había forma de dar de alta una segunda, así que una sucursal operaba de
 * hecho con una sola por mucho que el modelo admitiera varias.
 *
 * Una caja con sesión viva no se puede desactivar: quedaría una sesión abierta
 * colgando de una caja que ya no se lista, sin forma de cerrarla desde el POS.
 */
export function CashRegistersPanel() {
  const { registers, capacity, loading, error, saving, create, rename, setActive } =
    useCashRegisters()

  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const openCount = capacity?.openSessions ?? 0
  const maxLabel = capacity?.maxSessions == null ? 'sin límite' : `${capacity.maxSessions}`

  const sorted = useMemo(
    () => [...registers].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [registers],
  )

  const submitNew = async () => {
    const name = newName.trim()
    if (!name) return
    const err = await create(name)
    setActionError(err)
    if (!err) {
      setNewName('')
      setAdding(false)
    }
  }

  const submitRename = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    const err = await rename(id, name)
    setActionError(err)
    if (!err) setEditingId(null)
  }

  const toggleActive = async (r: CashRegister) => {
    setActionError(await setActive(r.id, !r.isActive))
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="text-[14px] font-semibold text-foreground flex items-center gap-2">
          <Monitor className="w-4 h-4 text-muted-foreground" />
          Cajas de la sucursal
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground">
            {openCount} abierta{openCount !== 1 ? 's' : ''} de {maxLabel} que permite tu plan
          </span>
          <button
            type="button"
            onClick={() => setAdding(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-background text-[12px] font-semibold text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva caja
          </button>
        </div>
      </div>

      {actionError && (
        <div className="px-4 py-2.5 text-[12.5px] text-red-600 bg-red-50 border-b border-border">
          {actionError}
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void submitNew()
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Nombre de la caja (ej. Caja 2, Mostrador)"
            className="flex-1 px-2.5 py-2 border border-border rounded-lg text-[13px] text-foreground bg-card outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={saving || !newName.trim()}
            onClick={() => void submitNew()}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-bold disabled:opacity-60"
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-3 py-2 rounded-lg border border-border text-[12.5px] font-semibold text-muted-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-[13px] text-muted-foreground">{error}</div>
      ) : sorted.length === 0 ? (
        <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
          Esta sucursal todavía no tiene cajas. Se creará una sola al abrir la primera sesión.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sorted.map(r => {
            const live = r.sessions[0]
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {editingId === r.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void submitRename(r.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="px-2 py-1.5 border border-border rounded-lg text-[13px] bg-card outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => void submitRename(r.id)}
                        className="p-1.5 rounded-md text-green-600 hover:bg-muted"
                        title="Guardar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-foreground">{r.name}</span>
                        {!r.isActive && (
                          <span className="text-[10.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            Inactiva
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {live
                          ? `${STATE_LABEL[live.status] ?? 'Ocupada'} · ${live.openedBy?.email ?? 'otro usuario'}`
                          : 'Libre'}
                      </div>
                    </>
                  )}
                </div>

                {editingId !== r.id && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.id)
                        setEditName(r.name)
                      }}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                      title="Renombrar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={saving || !!live}
                      onClick={() => void toggleActive(r)}
                      title={
                        live
                          ? 'No se puede desactivar una caja con una sesión abierta'
                          : r.isActive
                            ? 'Desactivar'
                            : 'Activar'
                      }
                      className="px-2.5 py-1.5 rounded-lg border border-border text-[12px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {r.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import {
  listCashRegisters,
  createCashRegister,
  updateCashRegister,
  fetchCashSessionCapacity,
  type CashRegister,
  type CashSessionCapacity,
} from '@/services/core/caja-service'

/**
 * Cajas físicas de la sucursal activa.
 *
 * El tope del plan cuenta **sesiones abiertas a la vez**, no cajas dadas de
 * alta: por eso la capacidad se pide aparte de la lista y se refresca tras cada
 * cambio — dar de alta una caja de reserva no consume cupo hasta que se abre.
 */
export function useCashRegisters() {
  const [registers, setRegisters] = useState<CashRegister[]>([])
  const [capacity, setCapacity] = useState<CashSessionCapacity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, cap] = await Promise.all([listCashRegisters(), fetchCashSessionCapacity()])
      setRegisters(list)
      setCapacity(cap)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'No se pudieron cargar las cajas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Devuelve el mensaje de error, o `null` si la operación salió bien. */
  const run = useCallback(
    async (op: () => Promise<unknown>): Promise<string | null> => {
      setSaving(true)
      try {
        await op()
        await load()
        return null
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        return msg ?? 'No se pudo completar la operación'
      } finally {
        setSaving(false)
      }
    },
    [load],
  )

  const create = useCallback((name: string) => run(() => createCashRegister(name)), [run])

  const rename = useCallback(
    (id: string, name: string) => run(() => updateCashRegister(id, { name })),
    [run],
  )

  const setActive = useCallback(
    (id: string, isActive: boolean) => run(() => updateCashRegister(id, { isActive })),
    [run],
  )

  return { registers, capacity, loading, error, saving, reload: load, create, rename, setActive }
}

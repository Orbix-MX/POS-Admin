import { useCallback, useEffect, useMemo, useState } from 'react'
import { createCliente, fetchClientes, type Cliente, type CreateClienteInput } from '~/services/orbix'
import { errorMessage } from '~/utils/api-error'

/**
 * Clientes del POS. Mismo endpoint que el Admin Web (`/customers`).
 * El alta rápida durante la venta usa `createCliente` sin salir de la pantalla,
 * de modo que el carrito nunca se pierde.
 */
export function useCustomers() {
  const [customers, setCustomers] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCustomers(await fetchClientes())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.telefono ?? '').toLowerCase().includes(q),
    )
  }, [customers, query])

  const create = useCallback(async (input: CreateClienteInput): Promise<Cliente | null> => {
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createCliente(input)
      setCustomers((prev) => [created, ...prev])
      return created
    } catch (e) {
      setCreateError(errorMessage(e))
      return null
    } finally {
      setCreating(false)
    }
  }, [])

  return {
    customers,
    filtered,
    query,
    setQuery,
    loading,
    error,
    reload: load,
    create,
    creating,
    createError,
    clearCreateError: () => setCreateError(null),
  }
}

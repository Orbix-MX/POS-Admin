import { useState, useEffect, useCallback } from 'react'
import { fetchContabilidad } from '@/services/core/contabilidad-service'
import type { ContabilidadData } from '@/services/core/contabilidad-service'

export type { ContabilidadData }

const EMPTY_DATA: ContabilidadData = {
  cuentasPorCobrar: [],
  cuentasPorPagar: [],
  resumen: { ingresos: "$0", egresos: "$0", utilidad: "$0", margen: "0%" },
}

export function useContabilidad() {
  const [contabilidad, setContabilidad] = useState<ContabilidadData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'cobrar' | 'pagar'>('cobrar')

  const loadContabilidad = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchContabilidad()
      setContabilidad(data)
    } catch {
      setError('Error al cargar contabilidad')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadContabilidad() }, [loadContabilidad])

  return {
    contabilidad,
    loading,
    error,
    tab,
    setTab,
    loadContabilidad,
  }
}

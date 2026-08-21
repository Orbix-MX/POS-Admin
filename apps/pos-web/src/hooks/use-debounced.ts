import { useEffect, useState } from 'react'

/**
 * Valor con retardo. Se usa para que teclear en el buscador no re-filtre el
 * catálogo en cada pulsación; el escáner de código de barras, en cambio, teclea
 * de golpe y termina con Enter, así que no se ve afectado.
 */
export function useDebounced<T>(value: T, delay = 180): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}

import { create } from 'zustand'
import {
  fetchActiveCashSession,
  openCashSession,
  type ApiCashSession,
  type OpenSessionInput,
} from '~/services/orbix'
import { errorMessage } from '~/utils/api-error'

/**
 * Estado de la caja del turno.
 *
 * Todo lo que aquí se guarda viene del backend (`/cash-sessions`): el POS no
 * recalcula esperado, diferencias ni saldos — los muestra. Sin sesión abierta
 * no se puede cobrar, y esa es la misma regla que aplica el Admin Web.
 */

interface CashState {
  session: ApiCashSession | null
  loading: boolean
  /** `true` cuando ya se consultó al menos una vez (para no parpadear al arrancar). */
  checked: boolean
  error: string | null
  opening: boolean
  openError: string | null

  refresh: (branchId?: string) => Promise<ApiCashSession | null>
  open: (input: OpenSessionInput) => Promise<ApiCashSession | null>
  reset: () => void
}

export const useCashStore = create<CashState>((set) => ({
  session: null,
  loading: false,
  checked: false,
  error: null,
  opening: false,
  openError: null,

  refresh: async (branchId) => {
    set({ loading: true, error: null })
    try {
      const session = await fetchActiveCashSession(branchId)
      set({ session, loading: false, checked: true })
      return session
    } catch (e) {
      set({ loading: false, checked: true, error: errorMessage(e) })
      return null
    }
  },

  open: async (input) => {
    set({ opening: true, openError: null })
    try {
      const session = await openCashSession(input)
      set({ session, opening: false, checked: true })
      return session
    } catch (e) {
      set({ opening: false, openError: errorMessage(e) })
      return null
    }
  },

  reset: () => set({ session: null, loading: false, checked: false, error: null, opening: false, openError: null }),
}))

/** El cobro solo está permitido con la caja en ABIERTA (EN_ARQUEO la congela). */
export const isSellable = (session: ApiCashSession | null): boolean => session?.status === 'ABIERTA'

/** Efectivo esperado según el backend; `null` si aún no lo reportó. */
export const expectedCash = (session: ApiCashSession | null): number | null => {
  if (!session) return null
  const fromSummary = session.summary?.expectedCash
  if (typeof fromSummary === 'number') return fromSummary
  if (session.expectedAmount != null) return Number(session.expectedAmount)
  return null
}

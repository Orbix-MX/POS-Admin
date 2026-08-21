import { create } from 'zustand'
import {
  fetchActiveCashSession,
  openCashSession,
  closeCashSession,
  withdrawCash,
  createCashCount,
  startCashCount,
  resumeCashSession,
  type ApiCashSession,
  type OpenSessionInput,
  type CloseSessionInput,
  type CashCountInput,
  type WithdrawCashInput,
  type ApiCashCount,
} from '~/services/orbix'
import { errorMessage } from '~/utils/api-error'

/**
 * Estado de la caja del turno.
 *
 * Todo lo que aquí se guarda viene del backend (`/cash-sessions`): el POS no
 * recalcula esperado, diferencias ni saldos — los muestra. Sin sesión abierta
 * no se puede cobrar, y esa es la misma regla que aplica el Admin Web.
 */

/**
 * Caja asignada a *esta terminal*, no al usuario.
 *
 * El relevo de turno entra en el mismo equipo y continúa la sesión abierta por
 * el turno anterior, así que la caja tiene que sobrevivir al cambio de usuario
 * y al cierre del navegador. Vive en localStorage por eso, y se limpia al
 * cerrar la sesión de caja, no al cerrar sesión de usuario.
 */
const REGISTER_KEY = 'pos_cash_register_id'
const REGISTER_NAME_KEY = 'pos_cash_register_name'

export function getTerminalRegisterId(): string | null {
  try {
    return window.localStorage.getItem(REGISTER_KEY)
  } catch {
    return null
  }
}

/** Nombre de la caja de la terminal, para poder rotularla sin pedir la lista. */
export function getTerminalRegisterName(): string | null {
  try {
    return window.localStorage.getItem(REGISTER_NAME_KEY)
  } catch {
    return null
  }
}

export function setTerminalRegisterId(id: string | null, name?: string | null): void {
  try {
    if (id) {
      window.localStorage.setItem(REGISTER_KEY, id)
      if (name) window.localStorage.setItem(REGISTER_NAME_KEY, name)
    } else {
      window.localStorage.removeItem(REGISTER_KEY)
      window.localStorage.removeItem(REGISTER_NAME_KEY)
    }
  } catch {
    // Modo privado o storage bloqueado: se opera sin memoria de terminal.
  }
}

interface CashState {
  session: ApiCashSession | null
  loading: boolean
  /** `true` cuando ya se consultó al menos una vez (para no parpadear al arrancar). */
  checked: boolean
  error: string | null
  opening: boolean
  openError: string | null

  /** Caja de esta terminal, para rotularla en la barra superior. */
  registerName: string | null
  /** Hay una operación de caja en vuelo (retiro, arqueo, corte). */
  working: boolean

  refresh: (branchId?: string) => Promise<ApiCashSession | null>
  /** Cambia la caja de la terminal y carga su sesión. No cierra nada. */
  switchRegister: (register: { id: string; name: string }, branchId?: string) => Promise<ApiCashSession | null>
  /**
   * `registerName` va como argumento aparte, no dentro del input: el API valida
   * con `forbidNonWhitelisted`, así que cualquier campo de más en el payload es
   * un 400. Fuera del objeto no se puede colar por descuido.
   */
  open: (input: OpenSessionInput, registerName?: string) => Promise<ApiCashSession | null>
  /** Retiro del cajón. Baja el efectivo esperado y queda en bitácora. */
  withdraw: (input: WithdrawCashInput) => Promise<string | null>
  /**
   * ABIERTA → EN_ARQUEO: congela la caja para contar sin cerrar el turno.
   * `pin` solo hace falta si el usuario no tiene `pos.cash:count`.
   */
  startCount: (pin?: string) => Promise<string | null>
  /** EN_ARQUEO → ABIERTA: vuelve a cobrar tras un arqueo de control. */
  resume: (pin?: string) => Promise<string | null>
  /** Registra un conteo (parcial o final) sobre la sesión viva. */
  count: (input: CashCountInput) => Promise<{ error: string | null; result: ApiCashCount | null }>
  /** Corte definitivo. Deja la sesión CERRADA y la terminal sin caja. */
  close: (input: CloseSessionInput) => Promise<string | null>
  reset: () => void
}

export const useCashStore = create<CashState>((set, get) => ({
  session: null,
  registerName: getTerminalRegisterName(),
  working: false,
  loading: false,
  checked: false,
  error: null,
  opening: false,
  openError: null,

  refresh: async (branchId) => {
    set({ loading: true, error: null })
    try {
      // Se pregunta por la caja de la terminal: así el relevo ve la sesión que
      // dejó abierta el turno anterior, aunque la abriera otra persona.
      const session = await fetchActiveCashSession(branchId, getTerminalRegisterId() ?? undefined)
      // La caja quedó sin sesión viva (alguien la cerró): se olvida para que la
      // terminal no siga preguntando por una caja que ya no está operando.
      if (!session) setTerminalRegisterId(null)
      set({
        session,
        registerName: session ? getTerminalRegisterName() : null,
        loading: false,
        checked: true,
      })
      return session
    } catch (e) {
      set({ loading: false, checked: true, error: errorMessage(e) })
      return null
    }
  },

  switchRegister: async (register, branchId) => {
    // Cambiar de caja es cambiar de vista, no cerrar el turno: la sesión de la
    // caja anterior sigue abierta y quien la tenga la sigue operando.
    setTerminalRegisterId(register.id, register.name)
    set({ registerName: register.name, loading: true, error: null })
    try {
      const session = await fetchActiveCashSession(branchId, register.id)
      set({ session, loading: false, checked: true })
      return session
    } catch (e) {
      set({ loading: false, checked: true, error: errorMessage(e) })
      return null
    }
  },

  open: async (input, registerName) => {
    set({ opening: true, openError: null })
    try {
      const session = await openCashSession(input)
      // La caja de la sesión recién abierta pasa a ser la de esta terminal.
      setTerminalRegisterId(session.cashRegisterId ?? input.cashRegisterId ?? null, registerName)
      set({ session, opening: false, checked: true, registerName: getTerminalRegisterName() })
      return session
    } catch (e) {
      set({ opening: false, openError: errorMessage(e) })
      return null
    }
  },

  withdraw: async (input) => {
    const { session } = get()
    if (!session) return 'No hay una caja abierta'
    set({ working: true })
    try {
      await withdrawCash(input)
      await get().refresh(session.branchId ?? undefined)
      return null
    } catch (e) {
      return errorMessage(e)
    } finally {
      set({ working: false })
    }
  },

  startCount: async (pin) => {
    const { session } = get()
    if (!session) return 'No hay una caja abierta'
    set({ working: true })
    try {
      const updated = await startCashCount(session.id, pin)
      set({ session: updated })
      return null
    } catch (e) {
      return errorMessage(e)
    } finally {
      set({ working: false })
    }
  },

  resume: async (pin) => {
    const { session } = get()
    if (!session) return 'No hay una caja abierta'
    set({ working: true })
    try {
      const updated = await resumeCashSession(session.id, pin)
      set({ session: updated })
      return null
    } catch (e) {
      return errorMessage(e)
    } finally {
      set({ working: false })
    }
  },

  count: async (input) => {
    const { session } = get()
    if (!session) return { error: 'No hay una caja abierta', result: null }
    set({ working: true })
    try {
      const result = await createCashCount(input)
      await get().refresh(session.branchId ?? undefined)
      return { error: null, result }
    } catch (e) {
      return { error: errorMessage(e), result: null }
    } finally {
      set({ working: false })
    }
  },

  close: async (input) => {
    const { session } = get()
    if (!session) return 'No hay una caja abierta'
    set({ working: true })
    try {
      await closeCashSession(session.id, input)
      // Cortada la caja, la terminal deja de apuntar a ella: la próxima
      // apertura vuelve a elegir, y el turno entrante no hereda el cajón del
      // anterior por inercia.
      setTerminalRegisterId(null)
      set({ session: null, registerName: null, checked: true })
      return null
    } catch (e) {
      return errorMessage(e)
    } finally {
      set({ working: false })
    }
  },

  reset: () => set({ session: null, loading: false, checked: false, error: null, opening: false, openError: null, working: false }),
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

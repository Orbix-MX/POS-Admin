import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  operatorLogin,
  setOperatorToken,
  clearOperatorToken,
  getOperatorToken,
  isOperatorTokenExpired,
  OPERATOR_EXPIRED_EVENT,
  type CurrentOperator,
} from '@/services/restaurant/operator-session-service'

export { OPERATOR_EXPIRED_EVENT } from '@/services/restaurant/operator-session-service'

/**
 * Sesión de operador (mesero) en web — identidad autenticada equivalente a la de
 * Mobile. Se obtiene canjeando un PIN por un JWT `typ:'operator'` y persiste
 * entre páginas (comanda ↔ caja) y recargas del navegador. Es INDEPENDIENTE de
 * la sesión administrativa (`auth-store`): cerrar el operador no toca al usuario,
 * y viceversa. El token vive en localStorage (operator-session-service); aquí
 * solo se guarda la metadata del operador.
 */
interface OperatorState {
  currentOperator: CurrentOperator | null
  isOperatorAuthenticated: boolean

  /** Canjea el PIN por un JWT operador para la sucursal dada. Lanza si el PIN/branch es inválido. */
  loginOperator: (pin: string, branchId: string) => Promise<void>
  /** Cierra la sesión de operador. NO afecta la sesión administrativa. */
  logoutOperator: () => void
  /** Revalida al hidratar/montar: si el token falta o venció, limpia la sesión. */
  restoreOperator: () => void
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set, get) => ({
      currentOperator: null,
      isOperatorAuthenticated: false,

      loginOperator: async (pin, branchId) => {
        const res = await operatorLogin(pin, branchId)
        setOperatorToken(res.accessToken)
        set({
          currentOperator: {
            employee: res.employee,
            role: res.role,
            permissions: res.permissions,
            branchId: res.branchId,
            restaurantVisibilityMode: res.restaurantVisibilityMode,
          },
          isOperatorAuthenticated: true,
        })
      },

      logoutOperator: () => {
        clearOperatorToken()
        set({ currentOperator: null, isOperatorAuthenticated: false })
      },

      restoreOperator: () => {
        const token = getOperatorToken()
        // Sin token, token vencido o sin metadata persistida → sesión inválida.
        if (!token || isOperatorTokenExpired(token) || !get().currentOperator) {
          clearOperatorToken()
          set({ currentOperator: null, isOperatorAuthenticated: false })
          return
        }
        set({ isOperatorAuthenticated: true })
      },
    }),
    {
      name: 'orbix-operator',
      // Solo la metadata se persiste; el token va en su propia clave de localStorage.
      partialize: (s) => ({ currentOperator: s.currentOperator }),
      // Al rehidratar tras un refresh, revalidar contra la expiración del token.
      onRehydrateStorage: () => (state) => {
        state?.restoreOperator()
      },
    },
  ),
)

// Sincroniza el store cuando el interceptor invalida el token de operador (401 en
// ruta de comanda): limpia la metadata para que las vistas vuelvan a pedir el PIN.
if (typeof window !== 'undefined') {
  window.addEventListener(OPERATOR_EXPIRED_EVENT, () => {
    useOperatorStore.getState().logoutOperator()
  })
}

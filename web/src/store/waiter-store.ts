import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VerifiedWaiter } from '@/services/restaurant/waiter-auth-service'

/**
 * Mesero identificado por PIN para el flujo de restaurante en web. Se verifica
 * una sola vez (comanda o caja) y persiste para TODAS las operaciones de la
 * sesión: abrir cuentas, enviar a cocina, cobrar. Así un PIN ingresado en la
 * comanda basta también para el cobro directo en caja (mismo `DiningOrder.waiterId`).
 * No es una sesión de auth (no emite token); solo recuerda al Employee operador.
 */
interface WaiterState {
  waiter: VerifiedWaiter | null
  setWaiter: (w: VerifiedWaiter) => void
  clearWaiter: () => void
}

export const useWaiterStore = create<WaiterState>()(
  persist(
    (set) => ({
      waiter: null,
      setWaiter: (waiter) => set({ waiter }),
      clearWaiter: () => set({ waiter: null }),
    }),
    { name: 'orbix-waiter' },
  ),
)

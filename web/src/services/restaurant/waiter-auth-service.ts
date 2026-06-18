import { api } from '@/lib/api-client'

/**
 * Autorización de mesero por PIN para la comanda web. NO emite token: la sesión
 * sigue siendo la del usuario; el PIN únicamente identifica al Employee (mesero)
 * al que se atribuirán las cuentas (`DiningOrder.waiterId`). Espejo ligero del
 * `pinLogin` de la app, sin device ni JWT operator.
 */

export interface VerifiedWaiter {
  id: string
  firstName: string
  lastName: string
  employeeNumber: string
}

export async function verifyWaiterPin(pin: string): Promise<VerifiedWaiter> {
  const { data } = await api.post<{ employee: VerifiedWaiter }>('/staff/pin-verify', { pin })
  return data.employee
}

export function waiterFullName(w: VerifiedWaiter): string {
  return `${w.firstName} ${w.lastName}`.trim()
}

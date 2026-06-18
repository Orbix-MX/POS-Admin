import { api } from '@/lib/api-client'

/** Assign / replace an employee's operative PIN (and optional comandera role). */
export async function assignEmployeePin(employeeId: string, pin: string, roleId?: string): Promise<void> {
  await api.patch(`/staff/employees/${employeeId}/pin`, { pin, roleId: roleId || undefined })
}

/** Remove an employee's operative PIN. */
export async function clearEmployeePin(employeeId: string): Promise<void> {
  await api.delete(`/staff/employees/${employeeId}/pin`)
}

/**
 * Rótulo del estado de una sesión de caja.
 *
 * `EN_ARQUEO` es una caja que dejó de cobrar para contar el efectivo: sigue
 * viva —no se puede abrir otra sobre esa caja— pero llamarla "Abierta" a secas
 * ocultaba por qué el POS no dejaba operar.
 */
export function sessionLabel(status?: string): string {
  switch (status) {
    case 'ABIERTA':
      return 'Abierta'
    case 'EN_ARQUEO':
      return 'En arqueo'
    case 'PENDIENTE_AUTORIZACION':
      return 'Pendiente de autorizar'
    default:
      return 'Ocupada'
  }
}

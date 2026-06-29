import type { StatusKey } from '@/constants/theme';

/** Default Spanish labels for table/order status. */
export const STATUS_LABELS: Record<StatusKey, string> = {
  available: 'Disponible',
  occupied: 'Ocupada',
  preparing: 'Preparando',
  ready: 'Por cobrar',
  rejected: 'Rechazada',
};

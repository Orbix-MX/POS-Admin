/**
 * Nombre legible del método de pago.
 *
 * `Payment.paymentMethod` es una columna `String` libre en el servidor, así que
 * no se puede tipar como union ni usar directamente para componer una clave de
 * traducción. Se acota a los que la app conoce y, para cualquier otro, se
 * muestra el valor crudo: es más útil que un "desconocido" que esconde lo que
 * el negocio sí registró.
 */
import type { TFunction } from 'i18next';

const KNOWN = ['CASH', 'CARD', 'TRANSFER', 'CREDITO'] as const;

export type KnownPaymentMethod = (typeof KNOWN)[number];

function isKnown(method: string): method is KnownPaymentMethod {
  return (KNOWN as readonly string[]).includes(method.toUpperCase());
}

export function paymentMethodLabel(method: string, t: TFunction): string {
  const upper = method.toUpperCase();
  return isKnown(upper) ? t(`orders.method.${upper}`) : method;
}

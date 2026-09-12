/**
 * Validación de los formularios de caja.
 *
 * Los importes se quedan como texto en el formulario —los `TextInput` de React
 * Native lo son— y se convierten a número al enviar, igual que en
 * `product-schemas.ts`. Las cotas son las mismas que declaran los DTO del
 * servidor, para que el cliente nunca acepte algo que la API va a rechazar.
 */
import type { TFunction } from 'i18next';
import { z } from 'zod';

/** Hasta dos decimales, sin signo: los `Decimal(10,2)` del servidor. */
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

/**
 * Acepta la coma decimal que traen los teclados de es-MX y pt-BR.
 *
 * Un campo vacío devuelve `NaN`, no `0`: `Number('')` es `0`, y con eso
 * "todavía no he escrito nada" y "quiero mover cero pesos" se vuelven el mismo
 * valor. Quien compare contra el disponible necesita distinguirlos.
 */
export function parseAmount(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return NaN;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function money(t: TFunction, min: number) {
  return z
    .string()
    .trim()
    .min(1, t('validation.amountRequired'))
    // La coma se normaliza antes de la regex para no rechazar "1,50".
    .transform((value) => value.replace(',', '.'))
    .refine((value) => MONEY_RE.test(value), t('validation.amountInvalid'))
    .refine((value) => Number(value) >= min, t('validation.amountTooLow'));
}

/**
 * Movimiento manual: gasto o ingreso.
 *
 * `reason` es opcional en el DTO del servidor, pero aquí se exige: un gasto sin
 * concepto es inútil en el corte, que es justo donde se lee. El servidor no
 * puede imponerlo porque el Admin Web tiene sus propios flujos.
 */
export function buildMovementSchema(t: TFunction) {
  return z.object({
    amount: money(t, 0.01),
    currency: z.enum(['MXN', 'USD']),
    reason: z.string().trim().min(1, t('validation.reasonRequired')).max(500),
    notes: z.string().trim().max(500).optional().or(z.literal('')),
  });
}

/** Retiro del cajón. `reason` sí es obligatorio también en el servidor. */
export function buildWithdrawSchema(t: TFunction) {
  return z.object({
    amount: money(t, 0.01),
    currency: z.enum(['MXN', 'USD']),
    reason: z.string().trim().min(1, t('validation.reasonRequired')).max(500),
  });
}

export type MovementFormValues = z.infer<ReturnType<typeof buildMovementSchema>>;
export type WithdrawFormValues = z.infer<ReturnType<typeof buildWithdrawSchema>>;

export const EMPTY_MOVEMENT_FORM: MovementFormValues = {
  amount: '',
  currency: 'MXN',
  reason: '',
  notes: '',
};

export const EMPTY_WITHDRAW_FORM: WithdrawFormValues = {
  amount: '',
  currency: 'MXN',
  reason: '',
};

/**
 * ¿Cabe este retiro en el cajón?
 *
 * El servidor rechaza retirar más del efectivo disponible —dejaría el esperado
 * en negativo, que no es un estado físico posible—, así que la UI comprueba lo
 * mismo antes de enviar: enterarse al pulsar es peor que no poder escribirlo.
 */
export function exceedsAvailable(amount: number, available: number): boolean {
  return Number.isFinite(amount) && amount > available;
}

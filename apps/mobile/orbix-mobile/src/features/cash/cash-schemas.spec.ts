/**
 * Validación de los formularios de caja.
 *
 * Dinero de verdad: un importe mal parseado se convierte en un movimiento
 * equivocado que el corte va a arrastrar hasta el final del turno.
 */
import type { TFunction } from 'i18next';

import {
  EMPTY_MOVEMENT_FORM,
  EMPTY_WITHDRAW_FORM,
  buildMovementSchema,
  buildWithdrawSchema,
  exceedsAvailable,
  parseAmount,
} from './cash-schemas';

/** `t` de mentira: devuelve la clave, que es lo que se quiere comprobar. */
const t = ((key: string) => key) as unknown as TFunction;

describe('parseAmount', () => {
  it('acepta el punto decimal', () => {
    expect(parseAmount('150.75')).toBe(150.75);
  });

  it('acepta la coma decimal de los teclados es-MX y pt-BR', () => {
    expect(parseAmount('150,75')).toBe(150.75);
  });

  it('ignora espacios alrededor', () => {
    expect(parseAmount('  20  ')).toBe(20);
  });

  it('devuelve NaN para lo que no es un número', () => {
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmount('1.2.3')).toBeNaN();
  });
});

describe('buildMovementSchema', () => {
  const schema = buildMovementSchema(t);

  const valid = { amount: '150.50', currency: 'MXN' as const, reason: 'Garrafón', notes: '' };

  it('acepta un movimiento completo', () => {
    const result = schema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('normaliza la coma decimal al validar', () => {
    const result = schema.safeParse({ ...valid, amount: '150,50' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe('150.50');
  });

  it('rechaza importe vacío', () => {
    const result = schema.safeParse({ ...valid, amount: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('validation.amountRequired');
  });

  it('rechaza cero: un movimiento de cero no mueve nada', () => {
    const result = schema.safeParse({ ...valid, amount: '0' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('validation.amountTooLow');
  });

  it('rechaza más de dos decimales — el servidor guarda Decimal(10,2)', () => {
    const result = schema.safeParse({ ...valid, amount: '10.999' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('validation.amountInvalid');
  });

  it('rechaza importes negativos', () => {
    expect(schema.safeParse({ ...valid, amount: '-50' }).success).toBe(false);
  });

  it('exige concepto aunque el DTO del servidor lo tenga opcional', () => {
    const result = schema.safeParse({ ...valid, reason: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe('validation.reasonRequired');
  });

  it('deja las notas vacías', () => {
    expect(schema.safeParse({ ...valid, notes: '' }).success).toBe(true);
  });

  it('el formulario vacío no valida — nada se envía por accidente', () => {
    expect(schema.safeParse(EMPTY_MOVEMENT_FORM).success).toBe(false);
  });
});

describe('buildWithdrawSchema', () => {
  const schema = buildWithdrawSchema(t);

  it('exige motivo, igual que el servidor', () => {
    expect(
      schema.safeParse({ amount: '300', currency: 'MXN', reason: '' }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ amount: '300', currency: 'MXN', reason: 'Caja fuerte' }).success,
    ).toBe(true);
  });

  it('el formulario vacío no valida', () => {
    expect(schema.safeParse(EMPTY_WITHDRAW_FORM).success).toBe(false);
  });
});

describe('exceedsAvailable', () => {
  it('deja retirar justo el disponible', () => {
    expect(exceedsAvailable(250, 250)).toBe(false);
  });

  it('bloquea un peso por encima', () => {
    expect(exceedsAvailable(250.01, 250)).toBe(true);
  });

  it('bloquea cualquier retiro con el cajón en cero', () => {
    expect(exceedsAvailable(1, 0)).toBe(true);
  });

  it('no bloquea mientras el importe no es un número — el campo está a medias', () => {
    expect(exceedsAvailable(NaN, 250)).toBe(false);
  });
});

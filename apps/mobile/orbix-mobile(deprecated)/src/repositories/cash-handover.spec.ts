/**
 * Mapeo de la bitácora de relevos.
 *
 * Lo que se vigila: que un tramo **sin cerrar** no se lea como un dato que
 * falta. `leftAt: null` significa «seguía dentro» — en un móvil no hay evento
 * de salida fiable, así que el tramo lo cierra la entrada del siguiente o el
 * cierre de la sesión.
 */
import type { CashHandoverDto } from '@/dto/cash.dto';

import { __test } from './cash-repository';

jest.mock('@/services/api', () => ({ http: {} }));

const { toHandover } = __test;

function dto(overrides: Partial<CashHandoverDto> = {}): CashHandoverDto {
  return {
    id: 'h-1',
    cashSessionId: 'cs-1',
    userId: 'u-ana',
    enteredAt: '2026-09-12T15:00:00.000Z',
    leftAt: null,
    user: { id: 'u-ana', firstName: 'Ana', lastName: 'Ruiz', email: 'ana@tienda.com' },
    ...overrides,
  };
}

describe('toHandover', () => {
  it('compone el nombre de quien tomó la caja', () => {
    expect(toHandover(dto()).name).toBe('Ana Ruiz');
  });

  it('cae al correo cuando no hay nombre', () => {
    const handover = toHandover(
      dto({ user: { id: 'u-x', firstName: null, lastName: null, email: 'x@tienda.com' } }),
    );
    expect(handover.name).toBe('x@tienda.com');
  });

  it('nombra al usuario borrado en vez de dejar el tramo anónimo', () => {
    // La FK es SetNull: dar de baja a alguien no borra que estuvo en la caja.
    const handover = toHandover(dto({ userId: null, user: null }));
    expect(handover.name).toBe('Sin usuario');
    expect(handover.userId).toBeNull();
  });

  it('conserva el tramo abierto como null, no como fecha inventada', () => {
    expect(toHandover(dto({ leftAt: null })).leftAt).toBeNull();
  });

  it('conserva la salida cuando el tramo sí se cerró', () => {
    const handover = toHandover(dto({ leftAt: '2026-09-12T19:03:00.000Z' }));
    expect(handover.leftAt).toBe('2026-09-12T19:03:00.000Z');
  });

  it('sobrevive a una respuesta sin la relación de usuario', () => {
    const bare = dto();
    delete bare.user;
    expect(toHandover(bare).name).toBe('Sin usuario');
  });
});

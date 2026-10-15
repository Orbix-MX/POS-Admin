import 'reflect-metadata';
import { CashSessionsController } from './cash-sessions.controller';

/**
 * @odd bloqueo-por-intentos-de-pin T-003
 * Los handlers que aceptan `authorizerPin` y solo tenían el límite global llevan un límite propio de 10 por
 * minuto. El `ThrottlerGuard` global lo aplica: no se repite `@UseGuards` (contaría cada petición dos veces).
 */

const PIN_HANDLERS = ['startCount', 'resumeOperation', 'createCount', 'close'] as const;

describe('CashSessionsController — límite propio en los handlers con authorizerPin', () => {
  it.each(PIN_HANDLERS)('%s tiene @Throttle de 10 por minuto', (name) => {
    const handler = CashSessionsController.prototype[name];

    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(10);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60_000);
  });

  it.each(PIN_HANDLERS)('%s no repite @UseGuards(ThrottlerGuard) (se contaría doble)', (name) => {
    const guards = Reflect.getMetadata('__guards__', CashSessionsController.prototype[name]) as unknown[] | undefined;

    expect(guards ?? []).toHaveLength(0);
  });
});

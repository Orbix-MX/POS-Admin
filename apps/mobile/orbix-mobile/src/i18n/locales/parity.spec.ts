/**
 * Paridad de claves entre los tres idiomas.
 *
 * `TranslationSchema` (el `typeof es`) ya obliga a que `en` y `pt` tengan la
 * misma forma, así que una clave que falta es un error de compilación. Lo que
 * el tipo **no** detecta es que se borre una rama entera de `es`: al ser la
 * referencia, quitar algo de ahí lo quita del esquema y los otros dos se
 * adaptan sin protestar.
 *
 * Esta prueba existe porque pasó exactamente eso: un reemplazo de texto mal
 * anclado se llevó por delante 355 líneas de los tres archivos a la vez y
 * `tsc` siguió en verde. El conteo total es lo único que lo delata.
 */
import { en } from './en';
import { es } from './es';
import { pt } from './pt';

type Nested = { [key: string]: string | Nested };

/** Todas las rutas hoja, en notación de puntos y ordenadas. */
function leafPaths(node: Nested, prefix = ''): string[] {
  return Object.entries(node)
    .flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === 'string' ? [path] : leafPaths(value, path);
    })
    .sort();
}

const esPaths = leafPaths(es as unknown as Nested);

describe('paridad de locales', () => {
  it.each([
    ['en', en],
    ['pt', pt],
  ])('%s tiene exactamente las mismas claves que es', (_name, locale) => {
    expect(leafPaths(locale as unknown as Nested)).toEqual(esPaths);
  });

  it.each([
    ['es', es],
    ['en', en],
    ['pt', pt],
  ])('%s no tiene cadenas vacías', (_name, locale) => {
    const empty = Object.entries(locale as unknown as Nested).length === 0;
    expect(empty).toBe(false);

    const blanks = leafPaths(locale as unknown as Nested).filter((path) => {
      const value = path
        .split('.')
        .reduce<string | Nested>((node, key) => (node as Nested)[key]!, locale as unknown as Nested);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(blanks).toEqual([]);
  });

  /**
   * Cota inferior, no cifra exacta: sube cuando se añaden claves, y falla si
   * una edición se lleva por delante una rama. Subirla a mano al añadir un
   * módulo es el punto — obliga a mirar el número.
   *
   * 430 antes del ciclo del día · 524 tras las fases 1-3 · 596 con todas.
   */
  it('conserva el volumen de claves esperado', () => {
    expect(esPaths.length).toBeGreaterThanOrEqual(590);
  });

  it('tiene las claves que consume el ciclo del día', () => {
    for (const key of [
      'cash.title',
      'cash.expectedCash',
      'cash.openingAmount',
      'cash.sales',
      'cash.income',
      'cash.expense',
      'cash.withdrawal',
      'cash.refund',
      'cash.status.ABIERTA',
      'cash.status.EN_ARQUEO',
      'cash.status.PENDIENTE_REVISION',
      'cash.status.CERRADA',
      'cash.frozen.countingTitle',
      'cash.frozen.reviewTitle',
      'cash.errors.authorizationRequired',
      'cash.errors.authorizationInvalid',
      'cash.errors.noOpenSession',
      'cash.count.title',
      'cash.count.freeze',
      'cash.count.resume',
      'cash.close.title',
      'cash.close.confirm',
      'cash.close.pendingTitle',
      'cash.close.differenceReason',
      'cash.pin.title',
      'cash.pin.authorize',
      'cash.history.title',
      'cash.detail.title',
      'cash.movementKind.EXPENSE',
      'cash.movementKind.INCOME',
      'cash.movementKind.WITHDRAWAL',
      'cash.movementType.SALE',
      'cash.movementType.REFUND',
      'inventory.adjust.title',
      'inventory.adjust.in',
      'inventory.adjust.out',
      'inventory.adjust.insufficient',
      'orders.title',
      'orders.range.today',
      'orders.range.week',
      'orders.range.month',
      'orders.badge.cancelled',
      'orders.badge.partiallyRefunded',
      'orders.method.CASH',
      'orders.refund.title',
      'orders.refund.confirm',
      'orders.detail.title',
      'home.kpiSoldToday',
      'home.kpiExpectedCash',
      'home.noShiftTitle',
      'drawer.modules.tickets',
      'errors.moduleNotInPlan',
      // Las que ya existían y el ciclo del día reutiliza.
      'settings.categories.cash.title',
      'drawer.modules.caja',
    ]) {
      expect(esPaths).toContain(key);
    }
  });
});

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
   * 430 antes del ciclo del día · 524 tras las fases 1-3 · 605 con la custodia
   * de caja (§1 bis) · 619 con la puerta de entrada (fases 0-1, que además
   * borran tres claves muertas del bloque decorativo de Inicio) · 634 con el
   * escáner (fase 2) · 657 con la importación masiva (fases 3-4). Son rutas
   * hoja, no dos-puntos del archivo.
   */
  it('conserva el volumen de claves esperado', () => {
    expect(esPaths.length).toBeGreaterThanOrEqual(650);
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
      'cash.registers.title',
      'cash.registers.auto',
      'cash.registers.add',
      'cash.registers.capacity',
      'cash.byUser.title',
      'cash.byUser.handovers',
      'cash.byUser.netCash',
      'cash.byUser.stillIn',
      'errors.moduleNotInPlan',
      // Las que ya existían y el ciclo del día reutiliza.
      'settings.categories.cash.title',
      'drawer.modules.caja',
    ]) {
      expect(esPaths).toContain(key);
    }
  });

  it('tiene las claves que consume la puerta de entrada', () => {
    for (const key of [
      // El alta decide «¿se vende o no?» con su propio copy, aparte de las
      // etiquetas técnicas de `products.status`.
      'products.statusChoice.ACTIVE',
      'products.statusChoice.DRAFT',
      'products.draftBanner.title',
      'products.draftBanner.action',
      'products.draftBanner.done',
      // Checklist de Inicio: una clave por paso, más el contador.
      'home.firstSteps',
      'home.checklist.progress',
      'home.checklist.product',
      'home.checklist.cash',
      'home.checklist.sale',
      'home.checklist.customer',
      // Vacíos con salida: el `hint` es lo que distingue «no hay nada todavía»
      // de «la búsqueda no encontró».
      'products.empty',
      'products.emptyHint',
      'customers.empty',
      'customers.emptyHint',
      'pos.noProducts',
      'pos.noProductsHint',
      'orders.empty',
      'orders.emptyHint',
      'orders.emptyAction',
    ]) {
      expect(esPaths).toContain(key);
    }
  });

  it('tiene las claves que consume el escáner', () => {
    for (const key of [
      'scanner.open',
      'scanner.aim',
      'scanner.capture',
      'scanner.resolving',
      'scanner.keepScanning',
      // Plural real: «1 artículo» / «3 artículos». i18next resuelve el sufijo,
      // así que las dos formas tienen que existir o la cuenta sale sin traducir.
      'scanner.counted_one',
      'scanner.counted_other',
      'scanner.ambiguous',
      'scanner.unknown.title',
      'scanner.unknown.hint',
      'scanner.unknown.create',
      // El permiso denegado tiene dos salidas distintas: volver a pedirlo
      // (Android) o abrir los ajustes del sistema (iOS, donde no se repregunta).
      'scanner.permission.title',
      'scanner.permission.hint',
      'scanner.permission.allow',
      'scanner.permission.openSettings',
    ]) {
      expect(esPaths).toContain(key);
    }
  });

  it('tiene las claves que consume la importación masiva', () => {
    for (const key of [
      // Una sola pantalla para las dos entidades: solo cambian estos textos.
      'import.products.title',
      'import.products.hint',
      'import.customers.title',
      'import.customers.hint',
      'import.step1',
      'import.step1Hint',
      'import.step2',
      'import.step2Hint',
      'import.downloadXlsx',
      'import.downloadCsv',
      'import.pickFile',
      'import.savedTo',
      'import.tooLarge',
      // El recuento se enseña entero, errores incluidos: esconderlos hace que
      // el hueco se descubra semanas después, vendiendo algo que no existe.
      'import.doneClean',
      'import.donePartial',
      'import.rows',
      'import.created',
      'import.updated',
      'import.failed',
      'import.errorLine',
      'import.moreErrors',
      'import.copyErrors',
      'import.errorsCopied',
    ]) {
      expect(esPaths).toContain(key);
    }
  });
});

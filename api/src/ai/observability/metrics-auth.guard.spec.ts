import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { MetricsAuthGuard } from './metrics-auth.guard';

/**
 * M-03 — `/metrics` era `@Public()` sin ningún control propio: cualquiera en
 * Internet veía volumen de uso por feature, distribución de planes y tasas
 * de error. Fail-closed: sin `METRICS_SCRAPE_TOKEN`, el endpoint no sirve.
 */
function contextWithAuth(header?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: header } }),
    }),
  } as never;
}

describe('MetricsAuthGuard', () => {
  const ORIGINAL_ENV = process.env.METRICS_SCRAPE_TOKEN;
  afterEach(() => {
    process.env.METRICS_SCRAPE_TOKEN = ORIGINAL_ENV;
  });

  it('sin METRICS_SCRAPE_TOKEN configurado, rechaza con 503 (fail-closed)', () => {
    delete process.env.METRICS_SCRAPE_TOKEN;
    const guard = new MetricsAuthGuard();

    expect(() => guard.canActivate(contextWithAuth('Bearer cualquier-cosa'))).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rechaza sin el bearer token correcto', () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secreto-correcto';
    const guard = new MetricsAuthGuard();

    expect(() => guard.canActivate(contextWithAuth('Bearer incorrecto'))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(contextWithAuth(undefined))).toThrow(UnauthorizedException);
  });

  it('acepta el bearer token correcto', () => {
    process.env.METRICS_SCRAPE_TOKEN = 'secreto-correcto';
    const guard = new MetricsAuthGuard();

    expect(guard.canActivate(contextWithAuth('Bearer secreto-correcto'))).toBe(true);
  });
});

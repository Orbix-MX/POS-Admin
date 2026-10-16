import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { CouponsController } from './coupons.controller';

/**
 * @odd aislamiento-de-cupones T-001
 * El contador de usos de un cupón solo lo mueve el cobro de una orden. Una ruta HTTP que lo incremente con un
 * permiso de lectura permitía a una empresa agotar los cupones de otra (hallazgo 4 de la auditoría).
 */
describe('CouponsController — ninguna ruta mueve el contador de usos', () => {
  const proto = CouponsController.prototype as unknown as Record<string, unknown>;
  const handlers = Object.getOwnPropertyNames(proto).filter(
    (n) => n !== 'constructor' && typeof proto[n] === 'function',
  );

  it('no declara ninguna ruta increment-usage', () => {
    const paths = handlers.map((n) => String(Reflect.getMetadata(PATH_METADATA, proto[n] as object) ?? ''));

    expect(paths.filter((p) => p.includes('increment'))).toEqual([]);
  });

  it('no tiene ningún handler llamado incrementUsage', () => {
    expect(handlers).not.toContain('incrementUsage');
  });

  it('las rutas que sí existen siguen ahí (la prueba mira el controlador correcto)', () => {
    expect(handlers).toEqual(expect.arrayContaining(['validateCoupon', 'remove']));
  });
});

import { Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

/**
 * M-06 — un 500 no debe ser invisible. `AllExceptionsFilter` reemplaza al
 * logger por defecto de Nest, así que sin un `Logger.error` explícito aquí
 * los errores de servidor no dejaban ningún rastro.
 */
function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method: 'GET', originalUrl: '/api/orders' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };
  return { host: host as never, status, json };
}

describe('AllExceptionsFilter — M-06: los 500 quedan en el log', () => {
  it('loguea un error inesperado (no HttpException) con su stack', () => {
    const filter = new AllExceptionsFilter();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host, status } = buildHost();

    filter.catch(new Error('boom'), host);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/orders'),
      expect.stringContaining('boom'),
    );
    expect(status).toHaveBeenCalledWith(500);
    errorSpy.mockRestore();
  });

  it('no genera ruido para errores esperados (4xx via HttpException)', () => {
    const { BadRequestException } = require('@nestjs/common');
    const filter = new AllExceptionsFilter();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host } = buildHost();

    filter.catch(new BadRequestException('dato inválido'), host);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

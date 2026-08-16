import { AiRateLimitService } from './ai-rate-limit.service';
import { AiException } from '../contracts/ai-error';

describe('AiRateLimitService', () => {
  let service: AiRateLimitService;

  beforeEach(() => {
    service = new AiRateLimitService();
  });

  it('permite hasta el límite de ráfaga y rechaza la siguiente', () => {
    for (let i = 0; i < 10; i++) {
      expect(() => service.assertBurstOk('user-1')).not.toThrow();
    }
    expect(() => service.assertBurstOk('user-1')).toThrow(AiException);
  });

  it('la ráfaga es independiente por clave', () => {
    for (let i = 0; i < 10; i++) service.assertBurstOk('user-1');
    expect(() => service.assertBurstOk('user-2')).not.toThrow();
  });

  it('acquireTenantSlot rechaza sobre la concurrencia máxima y releaseTenantSlot libera espacio', () => {
    service.acquireTenantSlot('tenant-1');
    service.acquireTenantSlot('tenant-1');
    service.acquireTenantSlot('tenant-1');
    expect(() => service.acquireTenantSlot('tenant-1')).toThrow(AiException);

    service.releaseTenantSlot('tenant-1');
    expect(() => service.acquireTenantSlot('tenant-1')).not.toThrow();
  });

  it('releaseTenantSlot nunca baja de cero', () => {
    expect(() => service.releaseTenantSlot('tenant-sin-slots')).not.toThrow();
    service.acquireTenantSlot('tenant-sin-slots');
    service.releaseTenantSlot('tenant-sin-slots');
    service.releaseTenantSlot('tenant-sin-slots');
    // Si el contador se hubiera ido a negativo, esto ya no lanzaría tras un solo acquire.
    service.acquireTenantSlot('tenant-sin-slots');
    service.acquireTenantSlot('tenant-sin-slots');
    service.acquireTenantSlot('tenant-sin-slots');
    expect(() => service.acquireTenantSlot('tenant-sin-slots')).toThrow(AiException);
  });
});

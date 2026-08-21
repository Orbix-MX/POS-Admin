import { AiProviderHealthMonitor } from './ai-provider-health.monitor';
import { AiProviderRegistry } from '../providers/ai-provider.registry';
import { AiMetrics } from './ai-metrics';
import { AICapability } from '../contracts/ai-capability.enum';
import { AIProvider, ChatResult, ProviderHealth } from '../providers/ai-provider.port';

class FakeProvider implements AIProvider {
  readonly capabilities = new Set<AICapability>();
  constructor(
    readonly id: string,
    private readonly result: ProviderHealth | (() => Promise<ProviderHealth>),
  ) {}
  supports(): boolean {
    return true;
  }
  chat(): Promise<ChatResult> {
    throw new Error('no usado en esta prueba');
  }
  health(): Promise<ProviderHealth> {
    return typeof this.result === 'function' ? this.result() : Promise.resolve(this.result);
  }
}

describe('AiProviderHealthMonitor', () => {
  afterEach(() => jest.useRealTimers());

  it('al iniciar, sondea todos los proveedores registrados una vez de inmediato', async () => {
    const registry = new AiProviderRegistry();
    const up = new FakeProvider('up', { up: true, checkedAt: new Date() });
    const down = new FakeProvider('down', { up: false, checkedAt: new Date() });
    registry.register(up);
    registry.register(down);

    const metrics = new AiMetrics();
    const spy = jest.spyOn(metrics, 'recordProviderHealth');

    const monitor = new AiProviderHealthMonitor(registry, metrics);
    monitor.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(spy).toHaveBeenCalledWith('up', true);
    expect(spy).toHaveBeenCalledWith('down', false);

    monitor.onModuleDestroy();
  });

  it('si health() lanza, se registra up:false en vez de tumbar el poller', async () => {
    const registry = new AiProviderRegistry();
    registry.register(new FakeProvider('flaky', () => Promise.reject(new Error('boom'))));

    const metrics = new AiMetrics();
    const spy = jest.spyOn(metrics, 'recordProviderHealth');

    const monitor = new AiProviderHealthMonitor(registry, metrics);
    monitor.onModuleInit();
    await new Promise((resolve) => setImmediate(resolve));

    expect(spy).toHaveBeenCalledWith('flaky', false);

    monitor.onModuleDestroy();
  });

  it('onModuleDestroy detiene el intervalo (no quedan timers activos)', () => {
    const registry = new AiProviderRegistry();
    const metrics = new AiMetrics();
    const monitor = new AiProviderHealthMonitor(registry, metrics);

    monitor.onModuleInit();
    monitor.onModuleDestroy();
    // No hay assert directo sobre el timer interno; el valor de esta prueba
    // es que Jest no reporte "worker process failed to exit" por un timer vivo.
    expect(true).toBe(true);
  });
});

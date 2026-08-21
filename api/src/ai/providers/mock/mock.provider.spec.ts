import { MockProvider } from './mock.provider';
import { AICapability } from '../../contracts/ai-capability.enum';
import { InvocationContext } from '../../contracts/ai-invocation.types';

describe('MockProvider', () => {
  let provider: MockProvider;
  const ctx: InvocationContext = { requestId: 'r1', tenantId: 't1', deadline: Date.now() + 5000 };

  beforeEach(() => {
    provider = new MockProvider();
  });

  it('declara CHAT y STRUCTURED_NATIVE', () => {
    expect(provider.supports([AICapability.CHAT, AICapability.STRUCTURED_NATIVE])).toBe(true);
    expect(provider.supports([AICapability.VISION])).toBe(false);
  });

  it('sin configurar, refleja el contenido de <entrada> como {"echo": ...}', async () => {
    const result = await provider.chat(
      {
        modelKey: 'mock-echo-v1',
        messages: [{ role: 'user', content: '<entrada>hola mundo</entrada>' }],
        temperature: 0,
        maxOutputTokens: 100,
      },
      ctx,
    );

    expect(JSON.parse(result.content)).toEqual({ echo: 'hola mundo' });
  });

  it('queueResponse sobrescribe el eco por defecto, una sola vez', async () => {
    provider.setLatencyMs(0);
    provider.queueResponse('{"echo":"configurado"}');

    const first = await provider.chat(
      { modelKey: 'm', messages: [{ role: 'user', content: '<entrada>x</entrada>' }], temperature: 0, maxOutputTokens: 10 },
      ctx,
    );
    const second = await provider.chat(
      { modelKey: 'm', messages: [{ role: 'user', content: '<entrada>y</entrada>' }], temperature: 0, maxOutputTokens: 10 },
      ctx,
    );

    expect(JSON.parse(first.content)).toEqual({ echo: 'configurado' });
    expect(JSON.parse(second.content)).toEqual({ echo: 'y' });
  });

  it('queueError lanza el error encolado una sola vez', async () => {
    provider.setLatencyMs(0);
    provider.queueError(new Error('caída simulada'));

    await expect(
      provider.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx),
    ).rejects.toThrow('caída simulada');

    // La segunda llamada ya no encuentra error encolado.
    await expect(
      provider.chat({ modelKey: 'm', messages: [{ role: 'user', content: '<entrada>ok</entrada>' }], temperature: 0, maxOutputTokens: 10 }, ctx),
    ).resolves.toBeDefined();
  });

  it('health refleja setHealthy', async () => {
    await expect(provider.health()).resolves.toMatchObject({ up: true });
    provider.setHealthy(false);
    await expect(provider.health()).resolves.toMatchObject({ up: false });
  });
});

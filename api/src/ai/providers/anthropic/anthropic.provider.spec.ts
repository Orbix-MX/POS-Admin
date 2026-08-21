import { AnthropicProvider } from './anthropic.provider';
import { AICapability } from '../../contracts/ai-capability.enum';
import { InvocationContext } from '../../contracts/ai-invocation.types';

describe('AnthropicProvider', () => {
  const ctx: InvocationContext = { requestId: 'r1', tenantId: 't1', deadline: Date.now() + 5000 };
  let provider: AnthropicProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new AnthropicProvider({ id: 'anthropic', apiKey: 'sk-ant-test' });
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('declara CHAT y STRUCTURED_NATIVE', () => {
    expect(provider.supports([AICapability.CHAT, AICapability.STRUCTURED_NATIVE])).toBe(true);
    expect(provider.supports([AICapability.EMBEDDINGS])).toBe(false);
  });

  it('envía x-api-key y anthropic-version, sin Authorization Bearer', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'hola' }] }),
    });

    await provider.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers.Authorization).toBeUndefined();
  });

  it('parsea el bloque tool_use cuando la petición pide salida estructurada', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'tool_use', name: 'x', input: { echo: 'hola' } }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
    });

    const result = await provider.chat(
      {
        modelKey: 'm',
        messages: [],
        temperature: 0,
        maxOutputTokens: 10,
        structuredOutput: { name: 'x', schema: { type: 'object' } },
      },
      ctx,
    );

    expect(result.content).toBe('{"echo":"hola"}');
    expect(result.totalTokens).toBe(15);
  });

  it('un HTTP no-ok lanza con status y cuerpo truncado', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 529,
      statusText: 'Overloaded',
      text: () => Promise.resolve('servidor saturado'),
    });

    await expect(
      provider.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx),
    ).rejects.toThrow(/529.*servidor saturado/s);
  });

  it('un fallo de red se relanza como Error transitorio (para que AiExecutionService reintente)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      provider.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx),
    ).rejects.toThrow(/fallo de red o timeout/);
  });

  it('health() devuelve up:true cuando /v1/models responde 200', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const health = await provider.health();
    expect(health.up).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('health() devuelve up:false sin lanzar cuando la conexión falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const health = await provider.health();
    expect(health.up).toBe(false);
    expect(health.detail).toContain('ECONNREFUSED');
  });
});

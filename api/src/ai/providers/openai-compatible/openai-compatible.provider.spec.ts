import { OpenAICompatibleProvider } from './openai-compatible.provider';
import { AICapability } from '../../contracts/ai-capability.enum';
import { InvocationContext } from '../../contracts/ai-invocation.types';

describe('OpenAICompatibleProvider', () => {
  const ctx: InvocationContext = { requestId: 'r1', tenantId: 't1', deadline: Date.now() + 5000 };
  let provider: OpenAICompatibleProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new OpenAICompatibleProvider({ id: 'local', baseUrl: 'http://localhost:11434/' });
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('declara CHAT y STRUCTURED_NATIVE (response_format, no GBNF hecho a mano)', () => {
    expect(provider.supports([AICapability.CHAT, AICapability.STRUCTURED_NATIVE])).toBe(true);
    expect(provider.supports([AICapability.EMBEDDINGS])).toBe(false);
  });

  it('normaliza la baseUrl quitando la barra final', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: '{"echo":"x"}' } }] }),
    });

    await provider.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('parsea la respuesta y calcula latencyMsProvider', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: '{"echo":"hola"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
    });

    const result = await provider.chat(
      { modelKey: 'm', messages: [{ role: 'user', content: 'hola' }], temperature: 0, maxOutputTokens: 10 },
      ctx,
    );

    expect(result.content).toBe('{"echo":"hola"}');
    expect(result.totalTokens).toBe(15);
    expect(result.latencyMsProvider).toBeGreaterThanOrEqual(0);
  });

  it('un HTTP no-ok lanza con status y cuerpo truncado', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: () => Promise.resolve('modelo cargando'),
    });

    await expect(
      provider.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx),
    ).rejects.toThrow(/503.*modelo cargando/s);
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
      'http://localhost:11434/v1/models',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('health() devuelve up:false sin lanzar cuando la conexión falla', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const health = await provider.health();
    expect(health.up).toBe(false);
    expect(health.detail).toContain('ECONNREFUSED');
  });

  it('envía Authorization cuando se configura apiKey', async () => {
    const withKey = new OpenAICompatibleProvider({ id: 'local', baseUrl: 'http://x', apiKey: 'secreto' });
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ choices: [{ message: { content: '{}' } }] }) });

    await withKey.chat({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 }, ctx);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secreto');
  });
});

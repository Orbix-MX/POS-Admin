import { AiExecutionService } from './ai-execution.service';
import { MockProvider } from '../providers/mock/mock.provider';
import { InvocationContext } from '../contracts/ai-invocation.types';
import { ChatRequest } from '../providers/ai-provider.port';

describe('AiExecutionService', () => {
  let execution: AiExecutionService;
  let provider: MockProvider;
  const req: ChatRequest = {
    modelKey: 'mock-echo-v1',
    messages: [{ role: 'user', content: '<entrada>hola</entrada>' }],
    temperature: 0,
    maxOutputTokens: 50,
  };

  beforeEach(() => {
    execution = new AiExecutionService();
    provider = new MockProvider();
    provider.setLatencyMs(1);
  });

  function ctxWithBudget(ms: number): InvocationContext {
    return { requestId: 'r1', tenantId: 't1', deadline: Date.now() + ms };
  }

  it('devuelve el resultado en el primer intento cuando el proveedor responde', async () => {
    const result = await execution.execute(provider, req, ctxWithBudget(5000));
    expect(JSON.parse(result.content)).toEqual({ echo: 'hola' });
  });

  it('reintenta ante un error transitorio y devuelve el resultado del segundo intento', async () => {
    provider.queueError(new Error('caída transitoria'));
    const result = await execution.execute(provider, req, ctxWithBudget(5000));
    expect(JSON.parse(result.content)).toEqual({ echo: 'hola' });
  }, 10000);

  it('agotados los reintentos, lanza AI_PROVIDER_UNAVAILABLE (sin fallback — ADR-0027)', async () => {
    provider.queueError(new Error('fallo 1'));
    provider.queueError(new Error('fallo 2'));
    provider.queueError(new Error('fallo 3'));

    await expect(execution.execute(provider, req, ctxWithBudget(5000))).rejects.toMatchObject({
      code: 'AI_PROVIDER_UNAVAILABLE',
    });
  }, 10000);

  it('con el deadline ya agotado, lanza AI_TIMEOUT sin llamar al proveedor', async () => {
    const chatSpy = jest.spyOn(provider, 'chat');
    const ctx = ctxWithBudget(-1);

    await expect(execution.execute(provider, req, ctx)).rejects.toMatchObject({
      code: 'AI_TIMEOUT',
    });
    expect(chatSpy).not.toHaveBeenCalled();
  });
});

import { fromAnthropicResponse, toAnthropicBody } from './anthropic.mapper';
import { ChatRequest } from '../ai-provider.port';

describe('anthropic mapper', () => {
  describe('toAnthropicBody', () => {
    it('separa el mensaje system al campo dedicado, no como turno', () => {
      const req: ChatRequest = {
        modelKey: 'claude-haiku-4-5-20251001',
        messages: [
          { role: 'system', content: 'eres un asistente' },
          { role: 'user', content: 'hola' },
        ],
        temperature: 0.2,
        maxOutputTokens: 500,
      };

      const body = toAnthropicBody(req);

      expect(body.system).toBe('eres un asistente');
      expect(body.messages).toEqual([{ role: 'user', content: 'hola' }]);
      expect(body.max_tokens).toBe(500);
      expect(body.temperature).toBe(0.2);
    });

    it('sin structuredOutput, no envía tools ni tool_choice', () => {
      const body = toAnthropicBody({ modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10 });
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
    });

    it('con structuredOutput, fuerza una única herramienta vía tool_choice', () => {
      const body = toAnthropicBody({
        modelKey: 'm',
        messages: [],
        temperature: 0,
        maxOutputTokens: 10,
        structuredOutput: { name: 'products.draft.v1', schema: { type: 'object' } },
      });

      expect(body.tools).toEqual([{ name: 'products.draft.v1', input_schema: { type: 'object' } }]);
      expect(body.tool_choice).toEqual({ type: 'tool', name: 'products.draft.v1' });
    });
  });

  describe('fromAnthropicResponse', () => {
    it('extrae el input del bloque tool_use como content JSON cuando se esperaba salida estructurada', () => {
      const result = fromAnthropicResponse(
        {
          content: [{ type: 'tool_use', name: 'x', input: { echo: 'hola' } }],
          usage: { input_tokens: 10, output_tokens: 5 },
        },
        42,
        true,
      );

      expect(result.content).toBe('{"echo":"hola"}');
      expect(result.inputTokens).toBe(10);
      expect(result.outputTokens).toBe(5);
      expect(result.totalTokens).toBe(15);
      expect(result.latencyMsProvider).toBe(42);
    });

    it('lanza si se esperaba tool_use y no llegó', () => {
      expect(() => fromAnthropicResponse({ content: [{ type: 'text', text: 'x' }] }, 1, true)).toThrow(/tool_use/);
    });

    it('sin salida estructurada, extrae el bloque text', () => {
      const result = fromAnthropicResponse({ content: [{ type: 'text', text: 'hola' }] }, 1, false);
      expect(result.content).toBe('hola');
    });

    it('lanza si no se esperaba estructura y tampoco hay bloque text', () => {
      expect(() => fromAnthropicResponse({ content: [] }, 1, false)).toThrow(/bloque text/);
    });
  });
});

import { fromOpenAiChatResponse, toOpenAiChatBody } from './openai-compatible.mapper';
import { ChatRequest } from '../ai-provider.port';

describe('openai-compatible mapper', () => {
  describe('toOpenAiChatBody', () => {
    it('mapea mensajes, temperatura y maxOutputTokens al protocolo OpenAI', () => {
      const req: ChatRequest = {
        modelKey: 'llama3.2:latest',
        messages: [
          { role: 'system', content: 'eres un asistente' },
          { role: 'user', content: 'hola' },
        ],
        temperature: 0.2,
        maxOutputTokens: 500,
      };

      const body = toOpenAiChatBody(req);

      expect(body.model).toBe('llama3.2:latest');
      expect(body.messages).toEqual([
        { role: 'system', content: 'eres un asistente' },
        { role: 'user', content: 'hola' },
      ]);
      expect(body.temperature).toBe(0.2);
      expect(body.max_tokens).toBe(500);
      expect(body.response_format).toBeUndefined();
    });

    it('sin structuredOutput, no envía response_format', () => {
      const body = toOpenAiChatBody({
        modelKey: 'm', messages: [], temperature: 0, maxOutputTokens: 10,
      });
      expect(body.response_format).toBeUndefined();
    });

    it('con structuredOutput, arma response_format json_schema estándar OpenAI', () => {
      const body = toOpenAiChatBody({
        modelKey: 'm',
        messages: [],
        temperature: 0,
        maxOutputTokens: 10,
        structuredOutput: { name: 'ai.echo.v1', schema: { type: 'object' } },
      });

      expect(body.response_format).toEqual({
        type: 'json_schema',
        json_schema: { name: 'ai.echo.v1', schema: { type: 'object' }, strict: true },
      });
    });

    it('respeta strict: false cuando se especifica', () => {
      const body = toOpenAiChatBody({
        modelKey: 'm',
        messages: [],
        temperature: 0,
        maxOutputTokens: 10,
        structuredOutput: { name: 'x', schema: {}, strict: false },
      });
      expect(body.response_format?.json_schema.strict).toBe(false);
    });
  });

  describe('fromOpenAiChatResponse', () => {
    it('extrae content y tokens de usage', () => {
      const result = fromOpenAiChatResponse(
        {
          choices: [{ message: { content: '{"echo":"hola"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
        42,
      );

      expect(result).toEqual({
        content: '{"echo":"hola"}',
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
        latencyMsProvider: 42,
      });
    });

    it('lanza si no hay choices[0].message.content', () => {
      expect(() => fromOpenAiChatResponse({ choices: [] }, 1)).toThrow(/message\.content/);
    });
  });
});

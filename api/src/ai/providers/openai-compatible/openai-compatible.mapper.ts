import { ChatMessage, ChatRequest, ChatResult } from '../ai-provider.port';

/**
 * Traduce entre el `ChatRequest`/`ChatResult` de Orbix y el protocolo
 * `/v1/chat/completions` que exponen llama.cpp, Ollama y OpenAI por igual —
 * es lo que permite que `OpenAICompatibleProvider` sea una sola clase para
 * los tres runtimes (D-05). `structuredOutput` viaja como `response_format`
 * estándar; verificado en desarrollo contra Ollama 0.32 (§09).
 */

interface OpenAiChatCompletionBody {
  model: string;
  messages: Array<{ role: ChatMessage['role']; content: string }>;
  temperature: number;
  max_tokens: number;
  response_format?: {
    type: 'json_schema';
    json_schema: { name: string; schema: Record<string, unknown>; strict: boolean };
  };
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export function toOpenAiChatBody(req: ChatRequest): OpenAiChatCompletionBody {
  return {
    model: req.modelKey,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: req.temperature,
    max_tokens: req.maxOutputTokens,
    response_format: req.structuredOutput
      ? {
          type: 'json_schema',
          json_schema: {
            name: req.structuredOutput.name,
            schema: req.structuredOutput.schema,
            strict: req.structuredOutput.strict ?? true,
          },
        }
      : undefined,
  };
}

export function fromOpenAiChatResponse(
  body: OpenAiChatCompletionResponse,
  latencyMsProvider: number,
): ChatResult {
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('OpenAICompatibleProvider: la respuesta no trae choices[0].message.content.');
  }

  return {
    content,
    inputTokens: body.usage?.prompt_tokens,
    outputTokens: body.usage?.completion_tokens,
    totalTokens: body.usage?.total_tokens,
    latencyMsProvider,
  };
}

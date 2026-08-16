import { ChatRequest, ChatResult } from '../ai-provider.port';

/**
 * Traduce entre `ChatRequest`/`ChatResult` y la Messages API de Anthropic —
 * protocolo distinto al de `openai-compatible.mapper.ts`: los mensajes
 * `system` van en un campo aparte, no como un turno más, y la salida
 * estructurada se logra forzando el uso de una única herramienta
 * (*tool forcing*), no con `response_format`.
 */

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicToolDefinition {
  name: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicMessagesBody {
  model: string;
  system?: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  temperature: number;
  tools?: AnthropicToolDefinition[];
  tool_choice?: { type: 'tool'; name: string };
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicMessagesResponse {
  content?: AnthropicContentBlock[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export function toAnthropicBody(req: ChatRequest): AnthropicMessagesBody {
  const systemMessages = req.messages.filter((m) => m.role === 'system').map((m) => m.content);
  const conversationMessages = req.messages
    .filter((m): m is { role: 'user' | 'assistant'; content: string } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body: AnthropicMessagesBody = {
    model: req.modelKey,
    system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
    messages: conversationMessages,
    max_tokens: req.maxOutputTokens,
    temperature: req.temperature,
  };

  if (req.structuredOutput) {
    body.tools = [{ name: req.structuredOutput.name, input_schema: req.structuredOutput.schema }];
    body.tool_choice = { type: 'tool', name: req.structuredOutput.name };
  }

  return body;
}

export function fromAnthropicResponse(
  body: AnthropicMessagesResponse,
  latencyMsProvider: number,
  expectsStructuredOutput: boolean,
): ChatResult {
  const toolUse = body.content?.find((block) => block.type === 'tool_use');
  const textBlock = body.content?.find((block) => block.type === 'text');

  if (expectsStructuredOutput) {
    if (!toolUse) {
      throw new Error('AnthropicProvider: la respuesta no trae un bloque tool_use — se esperaba salida estructurada.');
    }
  } else if (!textBlock) {
    throw new Error('AnthropicProvider: la respuesta no trae un bloque text.');
  }

  return {
    content: toolUse ? JSON.stringify(toolUse.input) : (textBlock?.text ?? ''),
    inputTokens: body.usage?.input_tokens,
    outputTokens: body.usage?.output_tokens,
    totalTokens:
      body.usage?.input_tokens != null && body.usage?.output_tokens != null
        ? body.usage.input_tokens + body.usage.output_tokens
        : undefined,
    latencyMsProvider,
  };
}

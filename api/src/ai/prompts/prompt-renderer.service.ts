import { Injectable } from '@nestjs/common';
import { ChatMessage } from '../providers/ai-provider.port';
import { PromptTemplate } from './prompt-registry.service';

const EXAMPLE_INPUT_PREFIX = 'ejemplo_entrada_';
const EXAMPLE_OUTPUT_PREFIX = 'ejemplo_salida_';

/**
 * Renderiza una plantilla ya cargada contra variables concretas y produce
 * los `ChatMessage[]` que recibe el proveedor.
 *
 * Tres tipos de sección, por nombre:
 * - `sistema` → un único mensaje `system`.
 * - `ejemplo_entrada_N` / `ejemplo_salida_N` → un par de turnos `user`/
 *   `assistant` — few-shot real vía historial de conversación, no texto
 *   descriptivo dentro del prompt de sistema. Van en el orden del archivo,
 *   antes del turno real.
 * - Cualquier otra sección (p. ej. `contexto`, `entrada`) → se concatena,
 *   en orden, en el mensaje `user` final — el mismo patrón de prefijo
 *   estable / cola volátil de §06, para que el runtime local pueda
 *   reutilizar el KV cache del prefijo.
 */
@Injectable()
export class PromptRenderer {
  render(template: PromptTemplate, variables: Record<string, string>): ChatMessage[] {
    const rendered = template.sections.map((section) => ({
      name: section.name,
      content: this.substitute(section.raw, variables),
    }));

    const messages: ChatMessage[] = [];
    const trailingUserParts: string[] = [];

    for (const section of rendered) {
      if (section.name === 'sistema') {
        messages.push({ role: 'system', content: section.content });
      } else if (section.name.startsWith(EXAMPLE_INPUT_PREFIX)) {
        messages.push({ role: 'user', content: section.content });
      } else if (section.name.startsWith(EXAMPLE_OUTPUT_PREFIX)) {
        messages.push({ role: 'assistant', content: section.content });
      } else {
        trailingUserParts.push(section.content);
      }
    }

    if (trailingUserParts.length > 0) {
      messages.push({ role: 'user', content: trailingUserParts.join('\n\n') });
    }

    return messages;
  }

  private substitute(raw: string, variables: Record<string, string>): string {
    return raw.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? '');
  }
}

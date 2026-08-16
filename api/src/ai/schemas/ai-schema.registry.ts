import { Injectable } from '@nestjs/common';
import { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export interface AiSchemaDef {
  key: string;
  version: number;
  schema: ZodTypeAny;
  /** Derivado del Zod una sola vez, al registrar — se envía como `response_format` (§04 del puerto). */
  jsonSchema: Record<string, unknown>;
}

export interface AiSchemaSource {
  key: string;
  version: number;
  schema: ZodTypeAny;
}

/**
 * Zod como fuente de verdad de los schemas de IA (D-02). La misma
 * definición produce el validador (`StructuredOutputService`) y el JSON
 * Schema que restringe al modelo — no se mantienen dos copias.
 *
 * Registro dinámico, no un mapa estático: los schemas de features de
 * negocio (p. ej. `products.draft.v1`) viven junto a su dominio —
 * `modules/retail/products/ai/product-draft.schema.ts` — y se registran
 * ahí, en el `onModuleInit` del módulo de esa feature. `AiSchemaRegistry`
 * no importa nada de `modules/`: la plataforma no conoce el dominio, el
 * dominio sí conoce la plataforma (misma dirección que el resto de la
 * arquitectura — ver §02). La feature de humo `ai.echo` se registra igual,
 * desde `AiModule`.
 */
@Injectable()
export class AiSchemaRegistry {
  private readonly schemas = new Map<string, AiSchemaDef>();

  register(source: AiSchemaSource): void {
    if (this.schemas.has(source.key)) return; // idempotente — onModuleInit puede correr más de una vez en tests
    this.schemas.set(source.key, {
      ...source,
      // Sin `name`: con nombre, zod-to-json-schema envuelve el resultado en
      // { $ref, definitions } — OpenAI, llama.cpp y Ollama esperan el JSON
      // Schema inline en response_format.json_schema.schema.
      jsonSchema: zodToJsonSchema(source.schema, { $refStrategy: 'none' }),
    });
  }

  resolve(schemaKey: string): AiSchemaDef {
    const def = this.schemas.get(schemaKey);
    if (!def) {
      throw new Error(`AiSchemaRegistry: no hay un schema registrado con clave "${schemaKey}".`);
    }
    return def;
  }
}

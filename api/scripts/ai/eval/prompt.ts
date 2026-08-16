import { ChatMessage } from '../../../src/ai/providers/ai-provider.port';
import { EvalCase } from './dataset';
import { EVAL_CATEGORIES, EVAL_TAX_CODES, EVAL_UNITS } from './tenant-catalog';

/**
 * Mismo patrón sistema/contexto/entrada que §06 del documento de
 * arquitectura: prefijo estable primero, entrada del usuario al final. No
 * usa `PromptRegistry` (esto no es una feature registrada en Fase 1/2) pero
 * reproduce su forma para que la evaluación mida lo que products.draft
 * medirá de verdad en la Fase 3.
 */
export function buildEvalMessages(evalCase: EvalCase): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'Eres el asistente de alta de productos de Orbix, un ERP para negocios ' +
        'mexicanos de retail. A partir de una descripción en lenguaje natural, ' +
        'propones un borrador de producto. Reglas: nunca inventes un dato que ' +
        'no esté en la entrada — si el costo no se menciona, usa null; nunca ' +
        'asignes un identificador; el nombre de categoría y de unidad deben ' +
        'ser exactamente uno de los de la lista dada. Responde solo con el ' +
        'objeto JSON solicitado, sin texto adicional.',
    },
    {
      role: 'user',
      content:
        `Categorías existentes: ${EVAL_CATEGORIES.join(', ')}.\n` +
        `Unidades disponibles: ${EVAL_UNITS.join(', ')}.\n` +
        `Códigos de impuesto válidos: ${EVAL_TAX_CODES.join(', ')}.\n\n` +
        `<entrada>${evalCase.input}</entrada>\n\n` +
        'Responde con un objeto JSON: {"name": string, "categoryName": string, ' +
        '"unitName": string, "costPrice": number|null, "price": number, ' +
        '"taxCode": string, "description": string|null}.',
    },
  ];
}

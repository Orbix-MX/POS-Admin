/**
 * Capacidades que un AIProvider puede declarar soportar. El enum existe
 * completo desde la v1 (§04 del documento de arquitectura) aunque solo dos
 * valores se usan hoy: CHAT y STRUCTURED_GRAMMAR. Declarar el resto ahora
 * evita renombrar cuando llegue un segundo proveedor (ADR-0025).
 */
export enum AICapability {
  CHAT = 'CHAT',
  STREAMING = 'STREAMING',
  STRUCTURED_GRAMMAR = 'STRUCTURED_GRAMMAR',
  STRUCTURED_NATIVE = 'STRUCTURED_NATIVE',
  TOOL_CALLING = 'TOOL_CALLING',
  VISION = 'VISION',
  EMBEDDINGS = 'EMBEDDINGS',
}

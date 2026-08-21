import { z } from 'zod';

/**
 * Schema de la feature de humo `ai.echo`. Trivial a propósito: su único
 * trabajo es ejercitar el pipeline completo (Zod → validación →
 * StructuredOutputService), no probar nada de dominio.
 */
export const echoOutputSchema = z.object({
  echo: z.string().min(1).max(2000),
});

export type EchoOutput = z.infer<typeof echoOutputSchema>;

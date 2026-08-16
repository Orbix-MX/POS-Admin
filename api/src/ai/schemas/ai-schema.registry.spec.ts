import { z } from 'zod';
import { AiSchemaRegistry } from './ai-schema.registry';

describe('AiSchemaRegistry', () => {
  const testSchema = z.object({ echo: z.string().min(1).max(2000) });

  function buildRegistry(): AiSchemaRegistry {
    const registry = new AiSchemaRegistry();
    registry.register({ key: 'test.v1', version: 1, schema: testSchema });
    return registry;
  }

  it('resuelve un schema registrado con su jsonSchema derivado', () => {
    const def = buildRegistry().resolve('test.v1');

    expect(def.key).toBe('test.v1');
    expect(def.version).toBe(1);
    expect(def.schema).toBeDefined();
    expect(def.jsonSchema).toMatchObject({
      type: 'object',
      properties: { echo: expect.objectContaining({ type: 'string' }) },
      required: ['echo'],
    });
  });

  it('el jsonSchema es la misma referencia en resoluciones repetidas (se deriva una sola vez)', () => {
    const registry = buildRegistry();
    const first = registry.resolve('test.v1');
    const second = registry.resolve('test.v1');
    expect(first.jsonSchema).toBe(second.jsonSchema);
  });

  it('registrar dos veces la misma clave es idempotente', () => {
    const registry = buildRegistry();
    registry.register({ key: 'test.v1', version: 1, schema: testSchema });
    expect(() => registry.resolve('test.v1')).not.toThrow();
  });

  it('lanza un error claro para una clave no registrada', () => {
    expect(() => buildRegistry().resolve('no.existe.v1')).toThrow(/no hay un schema registrado/);
  });
});

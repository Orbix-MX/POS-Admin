import { PromptRegistry } from './prompt-registry.service';
import { PromptRenderer } from './prompt-renderer.service';

describe('PromptRenderer', () => {
  const registry = new PromptRegistry();
  const renderer = new PromptRenderer();

  it('produce un mensaje system y uno user, con la variable sustituida', () => {
    const template = registry.resolve('ai.echo', 1);
    const messages = renderer.render(template, { message: 'coca de 600' });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('<entrada>coca de 600</entrada>');
    expect(messages[1].content).not.toContain('{{message}}');
  });

  it('una variable ausente se sustituye por cadena vacía, no revienta', () => {
    const template = registry.resolve('ai.echo', 1);
    const messages = renderer.render(template, {});
    expect(messages[1].content).toContain('<entrada></entrada>');
  });

  describe('few-shot (ejemplo_entrada_N / ejemplo_salida_N)', () => {
    const template = registry.resolve('products.draft', 1);

    it('intercala pares user/assistant de ejemplo, en orden, antes del turno real', () => {
      const messages = renderer.render(template, {
        message: 'coca de 600', currency: 'MXN', categories: 'Bebidas', taxCodes: 'IVA_16',
      });

      // system, luego N pares (user, assistant) de ejemplo, y el turno real al final.
      expect(messages[0].role).toBe('system');
      const middle = messages.slice(1, -1);
      expect(middle.length % 2).toBe(0);
      for (let i = 0; i < middle.length; i += 2) {
        expect(middle[i].role).toBe('user');
        expect(middle[i + 1].role).toBe('assistant');
      }
      expect(messages.at(-1)?.role).toBe('user');
    });

    it('cada ejemplo_salida es JSON válido — un few-shot roto envenena todas las respuestas reales', () => {
      // No importa el schema de negocio desde aquí (ai/ no conoce modules/,
      // regla 02): valida forma genérica, no conformidad de dominio.
      const messages = renderer.render(template, {
        message: 'x', currency: 'MXN', categories: 'x', taxCodes: 'IVA_16',
      });

      const exampleOutputs = messages.filter((m) => m.role === 'assistant');
      expect(exampleOutputs.length).toBeGreaterThan(0);
      for (const example of exampleOutputs) {
        expect(() => JSON.parse(example.content)).not.toThrow();
        const parsed = JSON.parse(example.content) as Record<string, unknown>;
        expect(typeof parsed).toBe('object');
        expect(parsed).toHaveProperty('name');
      }
    });

    it('el turno real contiene la entrada del usuario, no los ejemplos', () => {
      const messages = renderer.render(template, {
        message: 'ENTRADA-UNICA-DE-PRUEBA', currency: 'MXN', categories: 'x', taxCodes: 'IVA_16',
      });
      expect(messages.at(-1)?.content).toContain('ENTRADA-UNICA-DE-PRUEBA');
    });
  });
});

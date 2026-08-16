import { PromptRegistry } from './prompt-registry.service';

describe('PromptRegistry', () => {
  const registry = new PromptRegistry();

  it('carga y parsea la plantilla de ai.echo v1', () => {
    const template = registry.resolve('ai.echo', 1);

    expect(template.featureKey).toBe('ai.echo');
    expect(template.version).toBe(1);
    expect(template.locale).toBe('es-MX');

    const names = template.sections.map((s) => s.name);
    expect(names).toEqual(['sistema', 'entrada']);

    const entrada = template.sections.find((s) => s.name === 'entrada');
    expect(entrada?.raw).toContain('{{message}}');
  });

  it('cachea la plantilla tras la primera resolución', () => {
    const first = registry.resolve('ai.echo', 1);
    const second = registry.resolve('ai.echo', 1);
    expect(first).toBe(second);
  });

  it('lanza un error claro cuando la plantilla no existe', () => {
    expect(() => registry.resolve('no.existe', 99)).toThrow(/no existe la plantilla/);
  });
});

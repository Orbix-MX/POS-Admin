import { StructuredOutputService } from './structured-output.service';
import { echoOutputSchema } from './ai-echo.schema';

describe('StructuredOutputService', () => {
  const service = new StructuredOutputService();

  it('acepta JSON que cumple el schema', () => {
    const result = service.parse<{ echo: string }>('{"echo":"hola"}', echoOutputSchema);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ echo: 'hola' });
    expect(result.fieldsFailed).toEqual([]);
  });

  it('reporta fieldsFailed: ["*"] cuando el texto no es JSON', () => {
    const result = service.parse('no soy json', echoOutputSchema);
    expect(result.ok).toBe(false);
    expect(result.fieldsFailed).toEqual(['*']);
    expect(result.errorMessage).toContain('JSON válido');
  });

  it('reporta la ruta del campo que incumple el schema', () => {
    const result = service.parse('{"echo": 123}', echoOutputSchema);
    expect(result.ok).toBe(false);
    expect(result.fieldsFailed).toEqual(['echo']);
    expect(result.errorMessage).toContain('echo');
  });

  it('reporta el campo faltante como fieldsFailed', () => {
    const result = service.parse('{}', echoOutputSchema);
    expect(result.ok).toBe(false);
    expect(result.fieldsFailed).toEqual(['echo']);
  });
});

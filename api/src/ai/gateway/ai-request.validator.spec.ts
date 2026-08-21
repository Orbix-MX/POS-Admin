import { AiRequestValidator } from './ai-request.validator';
import { AiException } from '../contracts/ai-error';

describe('AiRequestValidator', () => {
  const validator = new AiRequestValidator();

  it('devuelve la definición de una feature registrada', () => {
    const def = validator.validate({ featureKey: 'ai.echo', input: {} });
    expect(def.key).toBe('ai.echo');
    expect(def.schemaKey).toBe('ai.echo.v1');
  });

  it('lanza AI_FEATURE_DISABLED para una feature no registrada', () => {
    expect(() => validator.validate({ featureKey: 'no.existe', input: {} })).toThrow(AiException);
    try {
      validator.validate({ featureKey: 'no.existe', input: {} });
      fail('debía lanzar');
    } catch (err) {
      expect(err).toBeInstanceOf(AiException);
      expect((err as AiException).code).toBe('AI_FEATURE_DISABLED');
      expect((err as AiException).getStatus()).toBe(403);
    }
  });
});

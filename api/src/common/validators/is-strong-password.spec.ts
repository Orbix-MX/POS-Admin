import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { IsStrongPassword, isCommonPassword } from './is-strong-password.decorator';

/**
 * Política de contraseñas. Antes bastaba `MinLength(6)` sin más reglas, repetido
 * en cuatro DTOs distintos que podían divergir. Ahora es un solo decorador.
 */

class Dto {
  @IsStrongPassword()
  password: string;
}

async function errorsFor(password: unknown): Promise<string[]> {
  const dto = plainToInstance(Dto, { password });
  const result = await validate(dto);
  return result.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('IsStrongPassword', () => {
  it('acepta una contraseña que cumple todas las reglas', async () => {
    await expect(errorsFor('Tormenta7Azul')).resolves.toEqual([]);
  });

  it('rechaza las de menos de 12 caracteres', async () => {
    const errors = await errorsFor('Corta7Ab');
    expect(errors.join(' ')).toContain('al menos 12');
  });

  it('rechaza la que era válida bajo la política vieja (6 caracteres)', async () => {
    // `MinLength(6)` dejaba pasar esto.
    await expect(errorsFor('abc123')).resolves.not.toEqual([]);
  });

  it('exige minúscula, mayúscula y número', async () => {
    expect((await errorsFor('todominusculas9')).join(' ')).toContain('mayúscula');
    expect((await errorsFor('TODOMAYUSCULAS9')).join(' ')).toContain('minúscula');
    expect((await errorsFor('SinNumerosAqui')).join(' ')).toContain('número');
  });

  it('rechaza espacios', async () => {
    expect((await errorsFor('Con Espacio77')).join(' ')).toContain('espacios');
  });

  it('rechaza contraseñas construidas sobre una de las más comunes', async () => {
    expect((await errorsFor('Password1234')).join(' ')).toContain('común');
    expect((await errorsFor('MiContrasena9')).join(' ')).toContain('común');
  });

  it('no supera el límite que bcrypt ignora en silencio (72 bytes)', async () => {
    const errors = await errorsFor('A1' + 'a'.repeat(100));
    expect(errors.join(' ')).toContain('64');
  });

  it('rechaza un valor que no es texto', async () => {
    await expect(errorsFor(12345678901234)).resolves.not.toEqual([]);
  });
});

describe('isCommonPassword', () => {
  it('detecta la común aunque venga disfrazada de mayúsculas o incrustada', () => {
    expect(isCommonPassword('PASSWORD')).toBe(true);
    expect(isCommonPassword('xxQwertyxx')).toBe(true);
    expect(isCommonPassword('Tormenta7Azul')).toBe(false);
  });
});

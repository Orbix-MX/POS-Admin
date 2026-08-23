import { applyDecorators } from '@nestjs/common';
import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  NotContains,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Minimum length. Nine keeps an offline guess against a bcrypt hash expensive
 * once combined with the character requirements below, while staying typeable;
 * the previous limit of six was well inside brute-force range on its own.
 */
export const PASSWORD_MIN_LENGTH = 9;

/** bcrypt silently ignores anything past 72 bytes, so cap below that. */
export const PASSWORD_MAX_LENGTH = 64;

/**
 * The 20 or so passwords that show up first in every credential-stuffing list.
 * Not a substitute for a real breach corpus (that belongs in a service with the
 * list on disk), but it catches the worst offenders at zero cost.
 */
const COMMON_PASSWORDS = [
  'password', 'contrasena', 'contraseña', '123456', '12345678', '123456789',
  'qwerty', 'abc123', 'password1', 'admin123', 'iloveyou', 'welcome',
  'monkey', 'dragon', 'letmein', 'football', 'orbix', 'administrador',
];

export function isCommonPassword(password: string): boolean {
  const normalized = password.toLowerCase();
  return COMMON_PASSWORDS.some((common) => normalized.includes(common));
}

/** Rejects a password built around one of the usual guesses. */
function IsNotCommonPassword(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotCommonPassword',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => typeof value === 'string' && !isCommonPassword(value),
        defaultMessage: () => 'La contraseña es demasiado común; elige otra.',
      },
    });
  };
}

/**
 * Password rules for every endpoint that accepts one: registration, admin-created
 * users, invitation acceptance and password resets.
 *
 * Kept as one decorator so the rules cannot drift apart between DTOs — which is
 * how `MinLength(6)` survived in four different files.
 */
export const IsStrongPassword = () =>
  applyDecorators(
    ApiProperty({
      minLength: PASSWORD_MIN_LENGTH,
      maxLength: PASSWORD_MAX_LENGTH,
      description: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres, con al menos una minúscula, una mayúscula y un número.`,
    }),
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    }),
    Matches(/[a-z]/, { message: 'La contraseña debe incluir al menos una minúscula.' }),
    Matches(/[A-Z]/, { message: 'La contraseña debe incluir al menos una mayúscula.' }),
    Matches(/[0-9]/, { message: 'La contraseña debe incluir al menos un número.' }),
    NotContains(' ', { message: 'La contraseña no puede contener espacios.' }),
    IsNotCommonPassword(),
  );

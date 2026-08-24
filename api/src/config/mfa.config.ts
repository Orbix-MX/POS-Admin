import { registerAs } from '@nestjs/config';
import { createHash } from 'crypto';

/**
 * Clave simétrica para cifrar el secreto TOTP en `User.mfaSecretEnc`.
 *
 * A diferencia de una contraseña, el secreto TOTP no se puede hashear: hay
 * que poder leerlo de vuelta para calcular el código esperado en cada
 * verificación. Se deriva de `MFA_ENCRYPTION_KEY` con SHA-256 para siempre
 * obtener 32 bytes exactos (lo que exige AES-256-GCM), sin importar el
 * formato en que se haya puesto la variable de entorno.
 *
 * Si falta la variable, se deriva de `JWT_SECRET` — el server sigue
 * arrancando (MFA es opcional, no debe tumbar el boot), pero en producción
 * hay que fijar `MFA_ENCRYPTION_KEY` aparte: reusar el JWT secret significa
 * que rotar uno rota el otro sin querer.
 */
export default registerAs('mfa', () => {
  const raw = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET || 'orbix-mfa-dev-key';
  return {
    encryptionKey: createHash('sha256').update(raw).digest(),
  };
});

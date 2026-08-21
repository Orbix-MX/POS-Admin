import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * Guard del flujo de redirect de Google.
 *
 * Hace dos cosas que `AuthGuard('google')` por sí solo no puede:
 *
 *  - Falla con 503 legible cuando no hay credenciales configuradas, en vez del
 *    "Unknown authentication strategy" de Passport.
 *  - Propaga el destino del frontend (`?redirect=`) dentro del parámetro `state`
 *    de OAuth, para saber a qué app volver tras el consentimiento. El valor se
 *    valida contra la allowlist al regresar, en el callback — nunca aquí.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    if (!this.config.get<boolean>('googleOAuth.enabled')) {
      throw new ServiceUnavailableException(
        'El acceso con Google no está configurado en este servidor',
      );
    }
    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const redirect = typeof req.query.redirect === 'string' ? req.query.redirect : undefined;

    return {
      // `state` vuelve intacto desde Google en el callback.
      state: redirect,
      // Fuerza el selector de cuenta: sin esto Google reusa en silencio la
      // sesión activa, y en una caja compartida eso entra con el usuario equivocado.
      prompt: 'select_account',
    };
  }
}

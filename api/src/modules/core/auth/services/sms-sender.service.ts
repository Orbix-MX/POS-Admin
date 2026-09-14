import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * El envío de SMS, detrás de una puerta.
 *
 * Hoy Orbix **no tiene contratado ningún proveedor de SMS**. Esta clase existe
 * para que esa ausencia sea explícita y esté en un solo sitio, en vez de
 * repartida en `if (process.env.TWILIO_...)` por el servicio de verificación.
 *
 * Fuera de producción, el código se escribe en el log del servidor: alcanza
 * para desarrollar y para las pruebas manuales en el emulador, donde no hay
 * teléfono real que reciba nada. En producción sin proveedor configurado, el
 * envío **falla con 503** — deliberadamente ruidoso. La alternativa sería
 * "verificar" teléfonos que nadie ha comprobado, que es peor que no
 * verificarlos: daría por bueno un dato falso.
 *
 * El código NUNCA viaja en la respuesta HTTP, ni siquiera en desarrollo: eso
 * convertiría la verificación en un trámite que cualquiera puede saltarse
 * leyendo la respuesta, y esa clase de atajo sobrevive hasta producción.
 */
@Injectable()
export class SmsSenderService {
  private readonly logger = new Logger(SmsSenderService.name);

  constructor(private readonly config: ConfigService) {}

  /** `true` cuando hay un proveedor real detrás. */
  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('SMS_PROVIDER'));
  }

  private get isProduction(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  async send(phone: string, message: string): Promise<void> {
    if (this.isConfigured) {
      // Cuando se contrate un proveedor, su cliente va aquí. Se deja sin
      // implementar a propósito en vez de dejar un stub que "parezca" enviar:
      // un fallo visible al conectar el proveedor es mejor que un envío
      // silencioso que nunca llega.
      throw new ServiceUnavailableException(
        `Proveedor de SMS "${this.config.get<string>('SMS_PROVIDER')}" declarado pero no implementado`,
      );
    }

    if (this.isProduction) {
      throw new ServiceUnavailableException(
        'La verificación por SMS no está disponible: no hay proveedor configurado',
      );
    }

    // Solo en desarrollo, y solo al log del servidor.
    this.logger.warn(`[SMS simulado] ${phone}: ${message}`);
  }
}

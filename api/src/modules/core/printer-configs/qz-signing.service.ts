import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createSign } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Firma de peticiones para QZ Tray con la llave privada del tenant.
 *
 * QZ Tray solicita autorización en CADA impresión cuando la petición no va
 * firmada. Firmando con una llave privada (RSA-SHA512) cuyo certificado público
 * esté instalado/confiado en QZ Tray, el aviso desaparece.
 *
 * Configuración (archivos PEM, fuera del control de versiones):
 *   QZ_CERT_PATH         (default: <cwd>/certs/qz-cert.pem)        — certificado público
 *   QZ_PRIVATE_KEY_PATH  (default: <cwd>/certs/qz-private-key.pem) — llave privada RSA
 *
 * Si no existen, la impresión sigue funcionando sin firma (QZ pedirá autorización).
 */
@Injectable()
export class QzSigningService {
  private readonly logger = new Logger('QzSigningService');
  private cert: string | null = null;
  private privateKey: string | null = null;
  private loaded = false;
  private warnedMissing = false;

  private load(): void {
    // Solo cacheamos cuando SÍ se cargó. Si los PEM aún no existen, reintentamos
    // en la siguiente llamada (cubre el caso de generar los certificados con la
    // API ya arrancada, sin tener que reiniciar).
    if (this.loaded) return;

    const certPath = process.env.QZ_CERT_PATH ?? resolve(process.cwd(), 'certs/qz-cert.pem');
    const keyPath = process.env.QZ_PRIVATE_KEY_PATH ?? resolve(process.cwd(), 'certs/qz-private-key.pem');

    if (!existsSync(certPath) || !existsSync(keyPath)) {
      if (!this.warnedMissing) {
        this.warnedMissing = true;
        this.logger.warn(
          'Certificado/llave de QZ no encontrados — impresión sin firma (QZ pedirá autorización en cada impresión)',
        );
      }
      return;
    }

    try {
      this.cert = readFileSync(certPath, 'utf8');
      this.privateKey = readFileSync(keyPath, 'utf8');
      this.loaded = true;
      this.logger.log('Certificado QZ Tray cargado — impresión firmada habilitada');
    } catch (e) {
      this.logger.error('Error cargando certificado QZ: ' + (e as Error).message);
    }
  }

  isConfigured(): boolean {
    this.load();
    return this.cert != null && this.privateKey != null;
  }

  getCertificate(): string {
    this.load();
    return this.cert ?? '';
  }

  /** Firma el string `data` con RSA-SHA512 y lo devuelve en base64 (formato que espera QZ). */
  sign(data: string): string {
    this.load();
    if (!this.privateKey) {
      throw new ServiceUnavailableException('Firma de QZ no configurada en el servidor');
    }
    const signer = createSign('SHA512');
    signer.update(data);
    signer.end();
    return signer.sign(this.privateKey, 'base64');
  }
}

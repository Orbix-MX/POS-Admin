import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';

import { PrismaService } from '../../../../database/prisma.service';
import { SmsSenderService } from './sms-sender.service';

/**
 * Verificación de un teléfono por código de seis dígitos.
 *
 * Mismo patrón que `PasswordResetService` —solo se guarda el hash, el secreto
 * nunca toca la base— pero con una diferencia que manda en todo el diseño: seis
 * dígitos son un millón de combinaciones, y un millón se agota por fuerza bruta
 * en minutos si nadie cuenta los intentos. De ahí las tres defensas:
 *
 * 1. **Intentos por código** (`attempts`): al quinto fallo el código muere, y
 *    hay que pedir uno nuevo — que cuesta un SMS y espera el enfriamiento.
 * 2. **Enfriamiento por reenvío**: 60 s entre envíos al mismo usuario.
 * 3. **Tope por número**: un teléfono no puede recibir más de 5 códigos por
 *    hora, sin importar cuántas cuentas lo pidan. Sin esto, crear cuentas sería
 *    una forma gratuita de mandarle SMS a un desconocido.
 *
 * El código caduca a los 10 minutos: suficiente para un SMS que tarda, corto
 * para que uno olvidado en la bandeja no siga sirviendo mañana.
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  private static readonly TTL_MINUTES = 10;
  private static readonly RESEND_SECONDS = 60;
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly MAX_PER_PHONE_PER_HOUR = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSenderService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * E.164 laxo: `+` y entre 8 y 15 dígitos.
   *
   * Normalizar antes de guardar es lo que hace que el tope por número no se
   * pueda esquivar: `+52 55 1234 5678`, `+525512345678` y `+52-55-1234-5678`
   * son el mismo teléfono, y sin normalizar contarían como tres.
   */
  private normalize(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    const normalized = digits.startsWith('+') ? digits : `+${digits}`;

    if (!/^\+\d{8,15}$/.test(normalized)) {
      throw new BadRequestException('El teléfono no tiene un formato válido');
    }
    return normalized;
  }

  async sendCode(
    userId: string,
    rawPhone: string,
  ): Promise<{ verificationId: string; resendAfterSeconds: number; maskedPhone: string }> {
    const phone = this.normalize(rawPhone);
    const now = new Date();

    // Enfriamiento: se mira el último envío de ESTE usuario, no del número, para
    // que el mensaje de error pueda decir cuánto falta sin filtrar si alguien
    // más está usando el mismo teléfono.
    const last = await this.prisma.phoneVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (last) {
      const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
      if (elapsed < PhoneVerificationService.RESEND_SECONDS) {
        throw new BadRequestException(
          `Espera ${Math.ceil(PhoneVerificationService.RESEND_SECONDS - elapsed)} segundos para pedir otro código`,
        );
      }
    }

    // Tope por número, a través de todas las cuentas: sin esto, registrar
    // cuentas sería una forma gratuita de bombardear a SMS a un desconocido.
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentForPhone = await this.prisma.phoneVerification.count({
      where: { phone, createdAt: { gte: hourAgo } },
    });

    if (recentForPhone >= PhoneVerificationService.MAX_PER_PHONE_PER_HOUR) {
      throw new BadRequestException(
        'Este número recibió demasiados códigos. Inténtalo de nuevo en una hora.',
      );
    }

    // Los códigos anteriores dejan de servir aunque no hayan caducado: un SMS
    // viejo en la bandeja no debe competir con el que se acaba de mandar.
    await this.prisma.phoneVerification.updateMany({
      where: { userId, verifiedAt: null, consumedAt: null },
      data: { consumedAt: now },
    });

    // `randomInt` y no `Math.random()`: este número es un secreto, y
    // `Math.random` es predecible a partir de unas cuantas salidas.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    const verification = await this.prisma.phoneVerification.create({
      data: {
        userId,
        phone,
        codeHash: this.hash(code),
        expiresAt: new Date(now.getTime() + PhoneVerificationService.TTL_MINUTES * 60 * 1000),
      },
      select: { id: true },
    });

    await this.sms.send(phone, `Tu código de verificación de Orbix es ${code}`);

    return {
      verificationId: verification.id,
      resendAfterSeconds: PhoneVerificationService.RESEND_SECONDS,
      // Solo los dos últimos dígitos: basta para que el usuario reconozca su
      // número y no sirve para averiguarlo si no es suyo.
      maskedPhone: `••${phone.slice(-2)}`,
    };
  }

  async verifyCode(
    userId: string,
    verificationId: string,
    code: string,
  ): Promise<{ verified: boolean; verifiedAt?: string }> {
    const verification = await this.prisma.phoneVerification.findFirst({
      // El `userId` va en el WHERE, no en una comprobación posterior: sin él,
      // conocer un `verificationId` ajeno bastaría para verificar el teléfono
      // de otra cuenta.
      where: { id: verificationId, userId },
    });

    if (!verification) {
      throw new NotFoundException('La verificación no existe o ya no es válida');
    }

    if (verification.verifiedAt) {
      // Ya estaba verificado: repetir la llamada no es un error, y responder
      // que sí evita que un reintento de red deje al usuario atascado.
      return { verified: true, verifiedAt: verification.verifiedAt.toISOString() };
    }

    if (verification.consumedAt) {
      throw new BadRequestException('Ese código ya no sirve: pediste uno nuevo');
    }

    if (verification.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('El código caducó. Pide uno nuevo.');
    }

    if (verification.attempts >= PhoneVerificationService.MAX_ATTEMPTS) {
      throw new BadRequestException('Demasiados intentos. Pide un código nuevo.');
    }

    const matches = verification.codeHash === this.hash(code.trim());

    if (!matches) {
      // El intento se cuenta ANTES de contestar, y se cuenta siempre: si solo
      // se contaran los fallos "interesantes", bastaría con equivocarse de otra
      // forma para tener intentos infinitos.
      await this.prisma.phoneVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('El código no coincide');
    }

    const verifiedAt = new Date();
    await this.prisma.phoneVerification.update({
      where: { id: verification.id },
      data: { verifiedAt },
    });

    this.logger.log(`Teléfono verificado para el usuario ${userId}`);

    return { verified: true, verifiedAt: verifiedAt.toISOString() };
  }
}

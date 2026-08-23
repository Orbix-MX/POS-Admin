import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../database/prisma.service';
import { PasswordUtil } from '../../../../common/utils/password.util';
import { EmailService } from '../../email/email.service';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Reseteo de contraseña por correo para una cuenta que ya existe.
 *
 * Mismo patrón que `TenantInvitation`/`OAuthTicket`/`RefreshToken`: token
 * opaco de un solo uso, solo el SHA-256 se guarda. La diferencia frente a una
 * invitación es la superficie de riesgo — aquí hay una cuenta real y
 * potencialmente credenciales comprometidas en juego, así que el TTL es de
 * una hora, no de días, y al completarse se revocan todas las sesiones
 * (refresh tokens) existentes: si alguien pidió el reseteo porque perdió el
 * control de la cuenta, la sesión del atacante no debe sobrevivir al cambio.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private static readonly TTL_MINUTES = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  private hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Pide el reseteo. Nunca revela si el correo existe: la respuesta al
   * llamador es idéntica en ambos casos (ver el controller), y aquí tampoco
   * se lanza ninguna excepción distinguible por timing significativo — el
   * envío de correo solo ocurre si el usuario existe, pero eso no se comunica
   * de vuelta.
   */
  async requestReset(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') return;

    // Un enlace anterior sin usar queda inservible al pedir uno nuevo — igual
    // que las invitaciones, para que un correo viejo en la bandeja no compita
    // con el más reciente.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PasswordResetService.TTL_MINUTES * 60_000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: this.hash(raw), expiresAt },
    });

    await this.email.sendPasswordReset({
      to: normalized,
      resetUrl: this.buildResetUrl(raw),
      expiresAt,
    });
  }

  private buildResetUrl(rawToken: string): string {
    const base =
      this.config.get<string>('FRONTEND_URL') ??
      process.env.FRONTEND_URL ??
      'http://localhost:5173';

    return `${base.replace(/\/$/, '')}/restablecer-contrasena/${rawToken}`;
  }

  /** Valida un token sin consumirlo — para que el front decida si mostrar el formulario. */
  async checkValid(rawToken: string): Promise<void> {
    await this.findLive(rawToken);
  }

  private async findLive(rawToken: string) {
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(rawToken ?? '') },
    });

    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new BadRequestException('Este enlace no es válido o ha expirado.');
    }

    return token;
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const token = await this.findLive(rawToken);

    const hashed = await PasswordUtil.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: {
          password: hashed,
          // Probar que se controla el correo es una vía legítima de recuperar
          // el acceso: un reseteo exitoso también levanta un bloqueo por
          // intentos fallidos.
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Cualquier sesión activa —incluida la de quien haya podido tomar la
    // cuenta— deja de servir; hay que volver a iniciar sesión con la
    // contraseña nueva en cada dispositivo.
    await this.refreshTokens.revokeAllForUser(token.userId);

    this.logger.log(`Contraseña restablecida para userId=${token.userId}`);
  }
}

import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../database/prisma.service';

const CHALLENGE_TTL_SECONDS = 300;
const BACKUP_CODE_COUNT = 8;

/**
 * MFA por TOTP (Google Authenticator/Authy), opcional — cada usuario decide
 * activarlo desde Configuración → Mi cuenta.
 *
 * Reutiliza el patrón de token opaco de un solo uso (ver OAuthTicket,
 * PasswordResetToken) para el `MfaChallengeTicket` que conecta "ya validé
 * contraseña/Google" con "ya validé el código de 6 dígitos" sin exponer el
 * JWT final hasta que ambos pasos pasen.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get encryptionKey(): Buffer {
    return this.config.get<Buffer>('mfa.encryptionKey') as Buffer;
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // iv.ciphertext.authTag, todo en base64 — un solo campo de texto en BD.
    return [iv, ciphertext, authTag].map((b) => b.toString('base64')).join('.');
  }

  private decrypt(encoded: string): string {
    const [ivB64, ciphertextB64, authTagB64] = encoded.split('.');
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Genera un secreto TOTP nuevo y lo guarda cifrado, pero SIN activar MFA
   * todavía — `confirmSetup` lo activa una vez que el usuario demuestra que
   * su app de autenticación ya lo tiene (si guardara `mfaEnabled: true` aquí,
   * un usuario que nunca llega a escanear el QR quedaría bloqueado de su
   * propia cuenta).
   */
  async startSetup(userId: string, email: string): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecretEnc: this.encrypt(secret) },
    });

    const otpauthUrl = authenticator.keyuri(email, 'Orbix ERP', secret);
    return { secret, otpauthUrl };
  }

  /** Confirma el setup con el primer código válido y genera los códigos de respaldo. */
  async confirmSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecretEnc) {
      throw new BadRequestException('No hay una configuración de MFA pendiente para confirmar');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA ya está activo en esta cuenta');
    }

    const secret = this.decrypt(user.mfaSecretEnc);
    if (!authenticator.verify({ token: code, secret })) {
      throw new BadRequestException('Código incorrecto');
    }

    const rawCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(5).toString('hex'),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } }),
      this.prisma.mfaBackupCode.deleteMany({ where: { userId } }),
      this.prisma.mfaBackupCode.createMany({
        data: rawCodes.map((raw) => ({ userId, codeHash: this.hashToken(raw) })),
      }),
    ]);

    return { backupCodes: rawCodes };
  }

  /**
   * Desactiva MFA. Requiere el código actual (o un backup code) — no basta
   * con estar logueado, porque una sesión ya abierta con el token robado es
   * exactamente el escenario contra el que MFA protege; permitir apagarlo
   * sin repreguntar anularía la protección para ese caso.
   */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEnc) {
      throw new BadRequestException('MFA no está activo en esta cuenta');
    }

    const valid = await this.verifyCodeOrBackup(user.id, user.mfaSecretEnc, code);
    if (!valid) throw new BadRequestException('Código incorrecto');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecretEnc: null },
      }),
      this.prisma.mfaBackupCode.deleteMany({ where: { userId } }),
    ]);
  }

  /** TOTP válido, o backup code válido (lo marca usado). */
  private async verifyCodeOrBackup(userId: string, secretEnc: string, code: string): Promise<boolean> {
    const secret = this.decrypt(secretEnc);
    const cleaned = code.trim();

    if (authenticator.verify({ token: cleaned, secret })) return true;

    const codeHash = this.hashToken(cleaned.toLowerCase());
    const { count } = await this.prisma.mfaBackupCode.updateMany({
      where: { userId, codeHash, usedAt: null },
      data: { usedAt: new Date() },
    });
    return count > 0;
  }

  /** Emite el ticket que representa "contraseña/Google ya validados, falta el código". */
  async issueChallenge(userId: string): Promise<string> {
    const raw = randomBytes(32).toString('hex');
    await this.prisma.mfaChallengeTicket.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + CHALLENGE_TTL_SECONDS * 1000),
      },
    });
    return raw;
  }

  /** Canjea el ticket + código y devuelve el userId si ambos son válidos. */
  async verifyChallenge(rawTicket: string, code: string): Promise<string> {
    if (!rawTicket || !code) throw new UnauthorizedException('Código inválido o expirado');

    const tokenHash = this.hashToken(rawTicket);
    const { count } = await this.prisma.mfaChallengeTicket.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException('El desafío de MFA expiró, inicia sesión de nuevo');

    const ticket = await this.prisma.mfaChallengeTicket.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    if (!ticket) throw new UnauthorizedException('El desafío de MFA expiró, inicia sesión de nuevo');

    const user = await this.prisma.user.findUnique({ where: { id: ticket.userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEnc) {
      throw new UnauthorizedException('El desafío de MFA expiró, inicia sesión de nuevo');
    }

    const valid = await this.verifyCodeOrBackup(user.id, user.mfaSecretEnc, code);
    if (!valid) throw new BadRequestException('Código incorrecto');

    return ticket.userId;
  }

  async purgeExpired(): Promise<void> {
    await this.prisma.mfaChallengeTicket
      .deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] } })
      .catch(() => undefined);
  }
}

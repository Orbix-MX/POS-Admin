import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../../database/prisma.service';

/**
 * Opaque, rotating refresh tokens for mobile clients.
 *
 * The raw token is returned to the client exactly once; only its SHA-256 hash
 * is persisted. On every refresh the presented token is revoked and a brand-new
 * one is issued (rotation). Presenting an already-revoked token is treated as
 * theft and revokes the user's entire refresh-token family.
 *
 * The refresh token deliberately carries no tenant/branch context — access-token
 * claims are rebuilt from the user's persisted lastTenantSelected/lastBranch at
 * refresh time (see AuthService.refresh), so they always reflect the latest
 * selection without mutating the refresh token on each step.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private ttlMs(): number {
    const days = this.config.get<number>('jwt.refreshExpiresInDays') ?? 30;
    return days * 24 * 60 * 60 * 1000;
  }

  /** Issues a new refresh token for a user and returns the raw (unhashed) value. */
  async issue(userId: string): Promise<string> {
    const rawToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hash(rawToken),
        expiresAt: new Date(Date.now() + this.ttlMs()),
      },
    });
    return rawToken;
  }

  /**
   * Validates + rotates a refresh token. Returns the owning userId and a fresh
   * raw refresh token. Throws UnauthorizedException for invalid/expired/reused
   * tokens (reuse also revokes the whole family).
   */
  async rotate(rawToken: string): Promise<{ userId: string; refreshToken: string }> {
    if (!rawToken) throw new UnauthorizedException('Refresh token required');

    const tokenHash = this.hash(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    // Reuse of an already-revoked token => probable theft. Burn the family.
    if (existing.revokedAt) {
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException('Refresh token already used');
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: this.hash(refreshToken),
          expiresAt: new Date(Date.now() + this.ttlMs()),
        },
      }),
    ]);

    return { userId: existing.userId, refreshToken };
  }

  /** Revokes a single refresh token by its raw value (logout). No-op if unknown. */
  async revokeByRaw(rawToken: string): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Revokes every active refresh token for a user. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly cache = new Map<string, number>(); // jti → expiresAt (ms), in-memory fast path
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Warm cache from DB on startup — loads all non-expired tokens
    const active = await this.prisma.revokedToken.findMany({
      where: { expiresAt: { gt: new Date() } },
      select: { jti: true, expiresAt: true },
    });
    for (const { jti, expiresAt } of active) {
      this.cache.set(jti, expiresAt.getTime());
    }
    this.cleanupInterval = setInterval(() => this.cleanup(), 3_600_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  async revoke(jti: string, expiresAtMs: number): Promise<void> {
    this.cache.set(jti, expiresAtMs);
    await this.prisma.revokedToken.upsert({
      where: { jti },
      update: { expiresAt: new Date(expiresAtMs) },
      create: { jti, expiresAt: new Date(expiresAtMs) },
    });
  }

  isRevoked(jti: string): boolean {
    const expiresAt = this.cache.get(jti);
    if (expiresAt === undefined) return false;
    if (Date.now() > expiresAt) {
      this.cache.delete(jti);
      return false;
    }
    return true;
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    for (const [jti, expiresAt] of this.cache) {
      if (now > expiresAt) this.cache.delete(jti);
    }
    await this.prisma.revokedToken.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }
}

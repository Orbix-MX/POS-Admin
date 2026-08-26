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

  /**
   * H-06 (re-auditoría): antes solo miraba el `Map` en memoria — con más de
   * una instancia del API, un `POST /auth/logout` en la instancia A no
   * revocaba nada en la B hasta que esa instancia se reiniciara y recargara
   * `onModuleInit`. Ahora, si no está en caché, consulta la fila en BD (que
   * `revoke()` ya escribe siempre) antes de decidir — y la sube a caché para
   * no repetir la consulta en la siguiente request con el mismo `jti`.
   */
  async isRevoked(jti: string): Promise<boolean> {
    const cached = this.cache.get(jti);
    if (cached !== undefined) {
      if (Date.now() > cached) {
        this.cache.delete(jti);
        return false;
      }
      return true;
    }

    const row = await this.prisma.revokedToken.findUnique({
      where: { jti },
      select: { expiresAt: true },
    });
    if (!row || row.expiresAt <= new Date()) return false;

    this.cache.set(jti, row.expiresAt.getTime());
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

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService implements OnModuleInit, OnModuleDestroy {
  private readonly blacklist = new Map<string, number>(); // jti → expiresAt (ms)
  private cleanupInterval: NodeJS.Timeout;

  onModuleInit() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 3_600_000);
  }

  onModuleDestroy() {
    clearInterval(this.cleanupInterval);
  }

  revoke(jti: string, expiresAtMs: number): void {
    this.blacklist.set(jti, expiresAtMs);
  }

  isRevoked(jti: string): boolean {
    const expiresAt = this.blacklist.get(jti);
    if (expiresAt === undefined) return false;
    if (Date.now() > expiresAt) {
      this.blacklist.delete(jti);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [jti, expiresAt] of this.blacklist) {
      if (now > expiresAt) this.blacklist.delete(jti);
    }
  }
}

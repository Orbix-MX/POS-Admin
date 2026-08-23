import { Inject, Injectable } from '@nestjs/common';
import { PERMISSION_CACHE_STORE } from './permission-cache.store';
import type { PermissionCacheStore } from './permission-cache.store';

/**
 * Cache of effective permissions, keyed by `userId:tenantId`.
 *
 * The TTL alone is not enough: revoking a role or a grant has to take effect
 * right away, not up to a minute later. Every write path that changes what a
 * user can do must call one of the `invalidate*` methods — that is why the cache
 * lives here instead of inside the guard, where no service could reach it.
 */
@Injectable()
export class PermissionCacheService {
  constructor(
    @Inject(PERMISSION_CACHE_STORE) private readonly store: PermissionCacheStore,
  ) {}

  private key(userId: string, tenantId: string): string {
    return `${tenantId}:${userId}`;
  }

  get(userId: string, tenantId: string): Promise<string[] | undefined> {
    return this.store.get(this.key(userId, tenantId));
  }

  set(userId: string, tenantId: string, permissions: string[]): Promise<void> {
    return this.store.set(this.key(userId, tenantId), permissions);
  }

  /** After changing one user's roles or individual grants. */
  invalidateUser(userId: string, tenantId: string): Promise<void> {
    return this.store.delete(this.key(userId, tenantId));
  }

  /**
   * After changing a role, since every user holding it is affected and finding
   * them would cost a query on a path that must not fail open.
   */
  invalidateTenant(tenantId: string): Promise<void> {
    // Tenant goes first in the key precisely so this prefix sweep is possible.
    return this.store.deleteByPrefix(`${tenantId}:`);
  }

  clear(): Promise<void> {
    return this.store.clear();
  }
}

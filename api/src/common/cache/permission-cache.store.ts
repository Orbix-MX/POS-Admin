/**
 * Storage behind the effective-permissions cache.
 *
 * Every method is async even though the in-memory implementation resolves
 * immediately: a shared store (Redis) is async by nature, so committing to
 * promises now means swapping the implementation later touches this folder only,
 * not each call site.
 */
export interface PermissionCacheStore {
  get(key: string): Promise<string[] | undefined>;
  set(key: string, permissions: string[]): Promise<void>;
  /** Drop one entry. */
  delete(key: string): Promise<void>;
  /** Drop every entry whose key matches the prefix (used to flush a whole tenant). */
  deleteByPrefix(prefix: string): Promise<void>;
  clear(): Promise<void>;
}

/** DI token: bind another implementation to move the cache out of process memory. */
export const PERMISSION_CACHE_STORE = Symbol('PERMISSION_CACHE_STORE');

export const PERMISSION_CACHE_TTL_MS = 60_000;
const CACHE_MAX_SIZE = 500;

interface Entry {
  permissions: string[];
  expiresAt: number;
}

/**
 * Process-local cache. Correct while the API runs as a single process.
 *
 * With more than one replica each process keeps its own map, so an invalidation
 * on one does not reach the others and a revoked permission could survive there
 * until the TTL expires. Moving to a shared store (or adding pub/sub
 * invalidation) is the fix at that point — see `PERMISSION_CACHE_STORE`.
 */
export class InMemoryPermissionCacheStore implements PermissionCacheStore {
  private readonly entries = new Map<string, Entry>();

  get(key: string): Promise<string[] | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(undefined);

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return Promise.resolve(undefined);
    }

    return Promise.resolve(entry.permissions);
  }

  set(key: string, permissions: string[]): Promise<void> {
    this.entries.set(key, { permissions, expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS });
    this.evictIfNeeded();
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  deleteByPrefix(prefix: string): Promise<void> {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key);
    }
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.entries.clear();
    return Promise.resolve();
  }

  private evictIfNeeded(): void {
    if (this.entries.size <= CACHE_MAX_SIZE) return;

    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
      if (this.entries.size <= CACHE_MAX_SIZE) return;
    }

    // Still over the limit: drop oldest first (Map preserves insertion order).
    for (const key of this.entries.keys()) {
      if (this.entries.size <= CACHE_MAX_SIZE) return;
      this.entries.delete(key);
    }
  }
}

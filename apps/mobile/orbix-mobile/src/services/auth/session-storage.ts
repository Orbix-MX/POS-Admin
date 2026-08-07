/**
 * Local mirror of the session, so a cold start renders the right screen before
 * `GET /auth/me` answers (and keeps working offline).
 *
 * Only non-sensitive data lives here — tokens go to `secureStorage`.
 */
import { StorageKeys } from '@/constants/storage-keys';
import type { Session } from '@/models/session';
import { kvStorage } from '@/services/storage/kv-storage';

export interface ActiveContext {
  tenantSlug?: string;
  branchId?: string;
}

export const sessionStorage = {
  getSession(): Session | null {
    return kvStorage.getJson<Session>(StorageKeys.session) ?? null;
  },

  saveSession(session: Session): void {
    kvStorage.setJson(StorageKeys.session, session);
  },

  getActiveContext(): ActiveContext | null {
    return kvStorage.getJson<ActiveContext>(StorageKeys.activeContext) ?? null;
  },

  saveActiveContext(context: ActiveContext): void {
    kvStorage.setJson(StorageKeys.activeContext, context);
  },

  clear(): void {
    kvStorage.remove(StorageKeys.session);
    kvStorage.remove(StorageKeys.activeContext);
  },

  hasCompletedOnboarding(): boolean {
    return kvStorage.getBoolean(StorageKeys.onboardingCompleted) ?? false;
  },

  markOnboardingCompleted(): void {
    kvStorage.setBoolean(StorageKeys.onboardingCompleted, true);
  },
} as const;

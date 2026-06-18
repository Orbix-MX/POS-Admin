import * as Crypto from 'expo-crypto';

/** Local primary key for offline-created rows. */
export function newId(): string {
  return Crypto.randomUUID();
}

/** ISO timestamp used for created_at / updated_at columns. */
export function nowIso(): string {
  return new Date().toISOString();
}

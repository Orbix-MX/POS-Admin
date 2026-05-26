import type { Database } from 'node-sqlite3-wasm';
export interface SyncResult {
    synced: number;
    errors: number;
}
export declare function cacheProducts(db: Database, products: Array<Record<string, unknown>>): void;
export declare function cacheCustomers(db: Database, customers: Array<Record<string, unknown>>): void;
export declare function syncPendingSales(db: Database, apiBase: string, token: string): Promise<SyncResult>;
export declare function syncPendingCashMovements(db: Database, apiBase: string, token: string): Promise<SyncResult>;

import { Database } from 'node-sqlite3-wasm';
export declare function getDb(): Database;
export declare function initDb(): void;
export declare function markSaleSynced(db: Database, id: string): void;
export declare function markSaleError(db: Database, id: string, error: string): void;
export declare function markCashMovementSynced(db: Database, id: string): void;
export declare function markCashMovementError(db: Database, id: string, error: string): void;

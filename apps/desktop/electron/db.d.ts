import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
export declare function initDb(): void;
export declare function markSaleSynced(db: Database.Database, id: string): void;
export declare function markSaleError(db: Database.Database, id: string, error: string): void;
export declare function markCashMovementSynced(db: Database.Database, id: string): void;
export declare function markCashMovementError(db: Database.Database, id: string, error: string): void;

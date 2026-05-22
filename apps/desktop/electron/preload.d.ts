export interface PendingSale {
    id: string;
    tenantId: string;
    branchId?: string | null;
    userId: string;
    clientId?: string | null;
    items: unknown[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    paymentAmount: number;
    changeAmount: number;
    notes?: string | null;
}
export interface PendingCashMovement {
    id: string;
    tenantId: string;
    branchId: string;
    sessionId: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    concept: string;
    notes?: string | null;
    userId: string;
}
export interface SyncResult {
    ok: boolean;
    synced?: number;
    errors?: number;
    cashSynced?: number;
    cashErrors?: number;
    error?: string;
}
export interface PrintTicketData {
    folio: string;
    fecha: string;
    cliente?: string;
    items: Array<{
        nombre: string;
        qty: number;
        precio: number;
        total: number;
    }>;
    subtotal: number;
    descuento: number;
    impuesto: number;
    total: number;
    metodoPago: string;
    cambio: number;
    cajero: string;
    sucursal: string;
}
declare const electronAPI: {
    app: {
        version: () => Promise<string>;
        platform: () => Promise<string>;
    };
    storage: {
        set: (key: string, value: string) => Promise<void>;
        get: (key: string) => Promise<string | null>;
        delete: (key: string) => Promise<void>;
    };
    db: {
        products: {
            get: () => Promise<unknown[]>;
            cache: (products: unknown[]) => Promise<{
                ok: boolean;
            }>;
        };
        customers: {
            get: () => Promise<unknown[]>;
            cache: (customers: unknown[]) => Promise<{
                ok: boolean;
            }>;
        };
        sales: {
            savePending: (sale: PendingSale) => Promise<{
                ok: boolean;
            }>;
            getPending: () => Promise<PendingSale[]>;
            countPending: () => Promise<number>;
        };
        cash: {
            savePending: (movement: PendingCashMovement) => Promise<{
                ok: boolean;
            }>;
        };
    };
    sync: {
        run: (opts: {
            apiBase: string;
            token: string;
        }) => Promise<SyncResult>;
        lastTime: () => Promise<number | null>;
    };
    print: {
        ticket: (data: PrintTicketData) => Promise<{
            ok: boolean;
            error?: string;
        }>;
        pdf: (opts: {
            title: string;
            html: string;
        }) => Promise<{
            ok: boolean;
            path?: string;
            error?: string;
        }>;
        printers: () => Promise<Electron.PrinterInfo[]>;
    };
    dialog: {
        save: (opts: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
    };
    updater: {
        check: () => Promise<{
            ok: boolean;
            error?: string;
        }>;
        download: () => Promise<void>;
        install: () => Promise<void>;
        onAvailable: (cb: (info: unknown) => void) => Electron.IpcRenderer;
        onProgress: (cb: (p: unknown) => void) => Electron.IpcRenderer;
        onReady: (cb: () => void) => Electron.IpcRenderer;
    };
};
export type ElectronAPI = typeof electronAPI;
export {};

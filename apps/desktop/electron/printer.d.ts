import type { BrowserWindow } from 'electron';
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
export declare function printTicket(win: BrowserWindow, data: PrintTicketData): Promise<void>;
export declare function printPdf(win: BrowserWindow, opts: {
    title: string;
    html: string;
}): Promise<string>;

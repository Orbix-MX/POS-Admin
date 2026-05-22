import type { BrowserWindow } from 'electron'
import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'

export interface PrintTicketData {
  folio: string
  fecha: string
  cliente?: string
  items: Array<{ nombre: string; qty: number; precio: number; total: number }>
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  metodoPago: string
  cambio: number
  cajero: string
  sucursal: string
}

// ── Ticket térmico (impresora por defecto del sistema) ────────────────────────

export async function printTicket(win: BrowserWindow, data: PrintTicketData): Promise<void> {
  const html = buildTicketHtml(data)

  return new Promise((resolve, reject) => {
    // Abre una ventana invisible, carga el HTML, imprime, cierra
    const { BrowserWindow: BW } = require('electron')
    const printWin = new BW({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    })

    printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    printWin.webContents.once('did-finish-load', () => {
      printWin.webContents.print(
        {
          silent: true,
          printBackground: true,
          margins: { marginType: 'none' },
        },
        (success: boolean, errorType?: string) => {
          printWin.close()
          if (success) resolve()
          else reject(new Error(errorType ?? 'Print failed'))
        },
      )
    })
  })
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export async function printPdf(win: BrowserWindow, opts: { title: string; html: string }): Promise<string> {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Guardar PDF',
    defaultPath: path.join(app.getPath('documents'), `${opts.title}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })

  if (!filePath) throw new Error('Cancelled')

  const { BrowserWindow: BW } = require('electron')
  const pdfWin = new BW({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(opts.html)}`)
  const pdfData = await pdfWin.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
  })
  pdfWin.close()

  fs.writeFileSync(filePath, pdfData)
  return filePath
}

// ── HTML builder para ticket 80mm ─────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildTicketHtml(d: PrintTicketData): string {
  const itemRows = d.items
    .map(
      (i) => `
    <tr>
      <td>${escHtml(i.nombre)}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right">$${fmt(i.precio)}</td>
      <td style="text-align:right">$${fmt(i.total)}</td>
    </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 80mm; padding: 4mm; }
  h1 { text-align: center; font-size: 14px; margin-bottom: 2mm; }
  .center { text-align: center; }
  .divider { border-top: 1px dashed #000; margin: 2mm 0; }
  table { width: 100%; border-collapse: collapse; }
  th { border-bottom: 1px solid #000; text-align: left; padding-bottom: 1mm; }
  td { padding: 0.5mm 0; vertical-align: top; }
  .totals td { font-weight: bold; }
  .totals .label { text-align: right; padding-right: 2mm; }
  .totals .value { text-align: right; }
  .grand-total { font-size: 13px; }
</style>
</head>
<body>
  <h1>${escHtml(d.sucursal)}</h1>
  <p class="center">Folio: ${escHtml(d.folio)}</p>
  <p class="center">${escHtml(d.fecha)}</p>
  <p class="center">Cajero: ${escHtml(d.cajero)}</p>
  ${d.cliente ? `<p class="center">Cliente: ${escHtml(d.cliente)}</p>` : ''}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Artículo</th><th style="text-align:center">Cant</th>
        <th style="text-align:right">Precio</th><th style="text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="divider"></div>
  <table class="totals">
    <tr><td class="label">Subtotal</td><td class="value">$${fmt(d.subtotal)}</td></tr>
    ${d.descuento > 0 ? `<tr><td class="label">Descuento</td><td class="value">-$${fmt(d.descuento)}</td></tr>` : ''}
    ${d.impuesto > 0 ? `<tr><td class="label">Impuesto</td><td class="value">$${fmt(d.impuesto)}</td></tr>` : ''}
    <tr class="grand-total">
      <td class="label">TOTAL</td><td class="value">$${fmt(d.total)}</td>
    </tr>
    <tr><td class="label">Pago (${escHtml(d.metodoPago)})</td><td class="value">$${fmt(d.cambio + d.total)}</td></tr>
    ${d.cambio > 0 ? `<tr><td class="label">Cambio</td><td class="value">$${fmt(d.cambio)}</td></tr>` : ''}
  </table>
  <div class="divider"></div>
  <p class="center">¡Gracias por su compra!</p>
</body>
</html>`
}

function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

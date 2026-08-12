/**
 * Servicio unificado de impresión.
 *
 * Estrategia por tipo de conexión configurada:
 *   NETWORK   → servidor envía directo por TCP (impresora en la misma red que el API)
 *   USB / BT / SYSTEM → QZ Tray en la máquina del cliente
 *
 * Si QZ Tray no está disponible y la impresora no es de red, la llamada falla
 * silenciosamente (la venta ya se procesó, no se bloquea el flujo).
 */

import { api } from '@/lib/api-client'
import { connectQZ, isQZActive, printWithQZ } from './qz-service'
import type { PrinterType } from './printers-service'

interface ReceiptData {
  bytes: number[]
  printerName: string | null
  connectionType: string | null
  printerFound: boolean
}

async function fetchReceiptData(orderId: string, printerType: PrinterType): Promise<ReceiptData> {
  const { data } = await api.post<ReceiptData>('/printer-configs/receipt-data', {
    orderId,
    printerType,
  })
  return data
}

async function fetchCashSessionReceiptData(cashSessionId: string, printerType: PrinterType): Promise<ReceiptData> {
  const { data } = await api.post<ReceiptData>('/printer-configs/cash-session-receipt-data', {
    cashSessionId,
    printerType,
  })
  return data
}

/**
 * Imprime el recibo de una orden.
 * Fire-and-forget: no lanza excepciones hacia el llamador.
 */
export async function printOrder(
  orderId: string,
  printerType: PrinterType = 'SALE_TICKET',
): Promise<void> {
  try {
    const receipt = await fetchReceiptData(orderId, printerType)

    if (!receipt.printerFound) return

    if (receipt.connectionType === 'NETWORK') {
      // Impresora de red → el servidor la alcanza directamente por TCP
      await api.post('/printer-configs/print-receipt', { orderId, printerType })
      return
    }

    // USB / BLUETOOTH / SYSTEM → necesita QZ Tray en el cliente
    const qzReady = (await isQZActive()) || (await connectQZ())
    if (!qzReady) {
      console.warn('[print-service] QZ Tray no disponible. Instálalo en https://qz.io/download')
      return
    }

    await printWithQZ(receipt.printerName, receipt.bytes)
  } catch (err) {
    // No bloquear el flujo principal por errores de impresión
    console.warn('[print-service] Error al imprimir:', err)
  }
}

/**
 * Imprime el ticket de arqueo (detalle completo de caja) al congelar la
 * sesión para contar. Fire-and-forget: no lanza excepciones hacia el llamador.
 */
export async function printCashSession(
  cashSessionId: string,
  printerType: PrinterType = 'TICKET',
): Promise<void> {
  try {
    const receipt = await fetchCashSessionReceiptData(cashSessionId, printerType)

    if (!receipt.printerFound) return

    if (receipt.connectionType === 'NETWORK') {
      await api.post('/printer-configs/print-cash-session-receipt', { cashSessionId, printerType })
      return
    }

    const qzReady = (await isQZActive()) || (await connectQZ())
    if (!qzReady) {
      console.warn('[print-service] QZ Tray no disponible. Instálalo en https://qz.io/download')
      return
    }

    await printWithQZ(receipt.printerName, receipt.bytes)
  } catch (err) {
    console.warn('[print-service] Error al imprimir ticket de arqueo:', err)
  }
}

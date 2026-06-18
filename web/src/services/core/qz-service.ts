/**
 * QZ Tray integration — impresión silenciosa desde el navegador.
 *
 * SETUP (una sola vez por máquina):
 * 1. Instalar QZ Tray desde https://qz.io/download
 * 2. Confiar el certificado del sistema en QZ Tray (Advanced → Site Manager,
 *    o colocando el certificado como `override.crt` en la carpeta de QZ Tray).
 *
 * La firma de cada petición la hace el backend (RSA-SHA512) con la llave
 * privada; el front solo pide el certificado público y la firma. Si el servidor
 * no tiene certificado configurado (`configured=false`), se cae a modo sin firma
 * (QZ pedirá autorización en cada impresión).
 */

import { fetchQzCertificate, signQzRequest } from './printers-service'

// qz-tray no tiene tipos perfectos en ESM — usamos import dinámico con cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let qz: any = null

/** True cuando el servidor tiene certificado/llave QZ configurados. */
let signingEnabled = false

async function getQZ() {
  if (!qz) {
    // Dynamic import para que Vite no lo bundlee cuando no se usa
    const mod = await import('qz-tray')
    qz = mod.default ?? mod
  }
  return qz
}

/** Configura la seguridad de QZ Tray: certificado público + firma vía backend. */
async function setupSecurity(instance: any) {
  // El certificado lo provee el backend; si no hay, caemos a modo sin firma.
  instance.security.setCertificatePromise((resolve: (c: string) => void) => {
    fetchQzCertificate()
      .then(({ certificate, configured }) => {
        signingEnabled = configured && !!certificate
        resolve(certificate || '')
      })
      .catch(() => {
        signingEnabled = false
        resolve('')
      })
  })

  instance.security.setSignatureAlgorithm?.('SHA512')

  instance.security.setSignaturePromise((toSign: string) => {
    return (resolve: (s: string | null) => void) => {
      if (!signingEnabled) {
        // Sin certificado en el servidor → modo sin firma (requiere "Allow unsigned" en QZ).
        resolve(null)
        return
      }
      signQzRequest(toSign)
        .then((signature) => resolve(signature || null))
        .catch(() => resolve(null))
    }
  })
}

/** Intenta conectarse a QZ Tray. Retorna `true` si tuvo éxito. */
export async function connectQZ(): Promise<boolean> {
  try {
    const instance = await getQZ()
    if (instance.websocket.isActive()) return true
    await setupSecurity(instance)
    await instance.websocket.connect({ retries: 1, delay: 500 })
    return true
  } catch {
    return false
  }
}

/** Cierra la conexión con QZ Tray. */
export async function disconnectQZ(): Promise<void> {
  try {
    const instance = await getQZ()
    if (instance.websocket.isActive()) {
      await instance.websocket.disconnect()
    }
  } catch { /* silent */ }
}

/** Indica si QZ Tray está conectado actualmente. */
export async function isQZActive(): Promise<boolean> {
  try {
    const instance = await getQZ()
    return instance.websocket.isActive()
  } catch {
    return false
  }
}

/**
 * Envía bytes ESC/POS a la impresora indicada vía QZ Tray.
 * @param printerName  Nombre de la impresora en el OS. `null` → usa la impresora por defecto.
 * @param bytes        Array de bytes ESC/POS.
 */
export async function printWithQZ(printerName: string | null, bytes: number[]): Promise<void> {
  const instance = await getQZ()

  if (!instance.websocket.isActive()) {
    throw new Error('QZ Tray no está conectado')
  }

  const name = printerName ?? (await instance.printers.getDefault())
  const config = instance.configs.create(name)

  // Los bytes ESC/POS se envían como hex; QZ los reconstruye crudos.
  // Enviar el Uint8Array directo hace que QZ lo serialice como texto
  // ("27,64,10,…") y la impresora imprime esos números literales.
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')

  await instance.print(config, [
    {
      type: 'raw',
      format: 'hex',
      data: hex,
    },
  ])
}

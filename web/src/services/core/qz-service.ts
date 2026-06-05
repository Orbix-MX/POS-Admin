/**
 * QZ Tray integration — impresión silenciosa desde el navegador.
 *
 * SETUP (una sola vez por máquina):
 * 1. Instalar QZ Tray desde https://qz.io/download
 * 2. En el ícono de la barra de tareas → Advanced → marcar "Allow unsigned"
 *    (para desarrollo/interno). En producción configura un certificado firmado
 *    vía VITE_QZ_CERT y VITE_QZ_KEY.
 */

// qz-tray no tiene tipos perfectos en ESM — usamos import dinámico con cast
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let qz: any = null

async function getQZ() {
  if (!qz) {
    // Dynamic import para que Vite no lo bundlee cuando no se usa
    const mod = await import('qz-tray')
    qz = mod.default ?? mod
  }
  return qz
}

/** Configura la seguridad de QZ Tray. */
async function setupSecurity(instance: any) {
  const cert = import.meta.env.VITE_QZ_CERT ?? ''
  const key  = import.meta.env.VITE_QZ_KEY  ?? ''

  instance.security.setCertificatePromise((resolve: (c: string) => void) => {
    resolve(cert)
  })

  instance.security.setSignatureAlgorithm?.('SHA512')

  instance.security.setSignaturePromise((_toSign: string) => {
    return (resolve: (s: string | null) => void) => {
      if (key) {
        // Producción: aquí iría la firma con la clave privada (RSA-SHA512)
        // Por ahora resolvemos vacío — configurar VITE_QZ_KEY con la clave privada PEM
        resolve('')
      } else {
        // Desarrollo: sin firma — requiere "Allow unsigned" en QZ Tray
        resolve(null)
      }
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

  await instance.print(config, [
    {
      type: 'raw',
      format: 'command',
      data: new Uint8Array(bytes),
    },
  ])
}

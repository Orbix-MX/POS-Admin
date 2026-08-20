/**
 * `web/src/services/core/qz-service.ts` (que el POS consume vía `print-service`)
 * importa `qz-tray`, cuyo tipado vive en `web/src/types/qz-tray.d.ts`. Ese
 * archivo no entra en el programa de este paquete porque sólo se incluye `src/`,
 * así que se referencia aquí en lugar de duplicar la declaración.
 */
/// <reference path="../../../web/src/types/qz-tray.d.ts" />
export {}

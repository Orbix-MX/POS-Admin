/**
 * Importación masiva desde una hoja de cálculo.
 *
 * Está parametrizado por entidad porque productos y clientes se importan con el
 * mismo contrato —misma plantilla, mismo `multipart`, mismo `ImportResult`— y
 * escribir dos repositorios idénticos garantizaría que se separen con el tiempo
 * sin que nadie lo decida.
 *
 * **El llenado ocurre fuera del teléfono.** Trece columnas no caben en una
 * pantalla de cuatro pulgadas, así que el flujo real es: se descarga la
 * plantilla, se comparte a donde el negocio tenga un teclado, y vuelve llena.
 * De ahí que descargar termine en el share sheet del sistema y no en una tabla
 * editable.
 */
import { File, Paths } from 'expo-file-system';

import { http } from '@/services/api';

/** Las entidades que hoy se pueden importar. */
export type ImportEntity = 'products' | 'customers';

/**
 * `xlsx` trae desplegables, las categorías reales y una hoja de instrucciones;
 * `csv` no trae nada de eso y a cambio lo abre cualquier cosa, incluido el
 * teléfono. Quien viene de otro sistema casi siempre tiene un CSV.
 */
export type ImportFormat = 'xlsx' | 'csv';

export interface ImportRowError {
  row: number;
  sku?: string;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

/** El archivo elegido en el selector del sistema. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
}

/**
 * Tope del servidor. Se comprueba **antes** de subir: una tienda con datos
 * móviles tarda minutos en mandar diez megas, y descubrir al final que el
 * servidor los rechaza es la peor forma de enterarse.
 */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const FILENAME: Record<ImportEntity, string> = {
  products: 'plantilla-productos',
  customers: 'plantilla-clientes',
};

const MIME: Record<ImportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

/**
 * Extensiones que acepta el selector.
 *
 * Se listan MIME y extensión a la vez porque los dos sistemas mienten de formas
 * distintas: Android suele anunciar `application/octet-stream` para cualquier
 * adjunto que no reconoce, y Windows marca los `.csv` como `vnd.ms-excel`
 * cuando Excel está instalado.
 */
export const IMPORT_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'application/octet-stream',
];

export const importRepository = {
  /**
   * Descarga la plantilla y la deja en la caché, lista para compartir.
   *
   * Se baja como binario y se escribe a disco en vez de pasar por una cadena:
   * un `.xlsx` es un zip, y convertirlo a texto lo corrompe en silencio — el
   * archivo se abre, parece vacío, y nadie entiende por qué.
   *
   * La caché y no el directorio de documentos: es un archivo de paso, y que el
   * sistema pueda borrarlo cuando necesite espacio es lo correcto.
   */
  async downloadTemplate(entity: ImportEntity, format: ImportFormat): Promise<File> {
    const buffer = await http.get<ArrayBuffer>(`/${entity}/import/template`, {
      params: format === 'csv' ? { format: 'csv' } : undefined,
      responseType: 'arraybuffer',
    });

    const file = new File(Paths.cache, `${FILENAME[entity]}.${format}`);
    // Sobrescribe la descarga anterior: si no, la segunda vez se comparte una
    // plantilla vieja, sin las categorías que se acaban de crear.
    if (file.exists) file.delete();
    file.create();
    file.write(new Uint8Array(buffer));

    return file;
  },

  /**
   * Sube el archivo lleno.
   *
   * `FormData` de React Native acepta un `{ uri, name, type }` en lugar de un
   * `Blob` y el adaptador lo transmite leyendo del disco, así que un archivo de
   * diez megas nunca pasa entero por memoria de JS.
   */
  async upload(entity: ImportEntity, file: PickedFile): Promise<ImportResult> {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name,
      // El servidor decide el formato por la extensión del nombre, no por esto:
      // el MIME que entrega el selector del sistema no es de fiar.
      type: file.mimeType || guessMime(file.name),
    } as unknown as Blob);

    return http.post<ImportResult>(`/${entity}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Subir un catálogo entero por la red de una tienda tarda más que
      // cualquier otra petición de la app, y el timeout normal la cortaría a
      // medias — dejando al usuario sin saber si se importó o no.
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },
};

const UPLOAD_TIMEOUT_MS = 120_000;

function guessMime(name: string): string {
  return /\.csv$/i.test(name) ? MIME.csv : MIME.xlsx;
}

/**
 * Las dos mitades de una importación: bajar la plantilla y subirla llena.
 *
 * Van juntas en un hook porque comparten la parte que importa —qué caché queda
 * mentirosa después— y porque el flujo real es uno solo aunque pase por fuera
 * del teléfono.
 */
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  importRepository,
  IMPORT_MIME_TYPES,
  MAX_IMPORT_BYTES,
  type ImportEntity,
  type ImportFormat,
  type ImportResult,
  type PickedFile,
} from '@/repositories/import-repository';
import { queryKeys } from '@/services/query/query-keys';

/** El archivo es más grande de lo que el servidor acepta. */
export class FileTooLargeError extends Error {
  constructor(readonly size: number) {
    super('file-too-large');
    this.name = 'FileTooLargeError';
  }
}

/**
 * Baja la plantilla y abre el share sheet del sistema.
 *
 * Compartir no es un extra: en el teléfono la plantilla no se puede llenar, así
 * que descargarla sin ofrecer cómo sacarla de ahí dejaría el archivo muerto en
 * una caché que el usuario no sabe abrir.
 */
export function useDownloadTemplate(entity: ImportEntity) {
  return useMutation({
    mutationFn: async (format: ImportFormat) => {
      const file = await importRepository.downloadTemplate(entity, format);

      // En un dispositivo sin nada con qué compartir, la descarga sigue siendo
      // válida: el archivo está en disco y se informa de ello.
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: file.name,
          UTI: format === 'csv' ? 'public.comma-separated-values-text' : 'org.openxmlformats.spreadsheetml.sheet',
        });
        return { file, shared: true };
      }

      return { file, shared: false };
    },
  });
}

/**
 * Abre el selector del sistema y sube lo elegido.
 *
 * El tamaño se comprueba **antes** de mandar nada: por la red de una tienda,
 * diez megas tardan minutos, y enterarse al final de que el servidor lo rechaza
 * es la peor forma de descubrirlo.
 */
export function useUploadImport(entity: ImportEntity) {
  const queryClient = useQueryClient();

  return useMutation<ImportResult | null, Error, void>({
    mutationFn: async () => {
      const picked = await DocumentPicker.getDocumentAsync({
        type: IMPORT_MIME_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      // Cancelar no es un error: el usuario cerró el selector y no hay nada que
      // contarle. `null` distingue ese caso de una importación con cero filas.
      if (picked.canceled || !picked.assets?.[0]) return null;

      const asset = picked.assets[0];
      if (asset.size != null && asset.size > MAX_IMPORT_BYTES) {
        throw new FileTooLargeError(asset.size);
      }

      const file: PickedFile = {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size,
      };

      return importRepository.upload(entity, file);
    },

    onSuccess: (result) => {
      // Nada que invalidar si se canceló o si no entró ni una fila: refrescar
      // por costumbre gasta datos de quien menos tiene.
      if (!result || result.created + result.updated === 0) return;

      if (entity === 'products') {
        // El listado y la retícula del POS leen del mismo árbol de claves, así
        // que invalidar la raíz cubre las dos —y también el detalle, que puede
        // haber cambiado de precio en la importación.
        void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      }

      // Los contadores de Inicio y el checklist de primeros pasos salen de
      // aquí: tras importar 400 productos, «crea tu primer producto» tiene que
      // aparecer tachado.
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
  });
}

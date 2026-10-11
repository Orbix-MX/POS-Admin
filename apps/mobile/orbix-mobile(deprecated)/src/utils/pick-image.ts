/**
 * `expo-image-picker` detrás de una sola llamada: permiso + selector, para que
 * la pantalla solo trate con "hay asset o no" y nunca con la máquina de estados
 * del permiso.
 *
 * El recorte va activado a propósito: el usuario encuadra antes de subir y el
 * asset resultante sale reescrito por el propio picker, no es el original de la
 * galería. El API solo acepta JPEG, PNG o WebP
 * (`FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })`), así que un
 * formato que se cuele igual se rechaza en el servidor — de ahí que quien sube
 * tenga que traducir ese error, no darlo por imposible.
 */
import * as ImagePicker from 'expo-image-picker';

/** Tope del API: `MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })`. */
export const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

export interface PickImageOptions {
  /** Proporción del recorte: `[1, 1]` para un logo, `[4, 3]` para una foto. */
  aspect?: [number, number];
}

export async function pickImageFromLibrary(
  options: PickImageOptions = {},
): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: options.aspect ?? [1, 1],
    quality: 0.85,
  });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0] ?? null;
}

/**
 * `true` cuando el asset ya excede el tope del API. `fileSize` es opcional en
 * `ImagePickerAsset` (Android no siempre lo reporta): sin dato se deja pasar y
 * decide el servidor, que es quien manda de todos modos.
 */
export function exceedsUploadSize(asset: { fileSize?: number | null }): boolean {
  return typeof asset.fileSize === 'number' && asset.fileSize > MAX_UPLOAD_SIZE;
}

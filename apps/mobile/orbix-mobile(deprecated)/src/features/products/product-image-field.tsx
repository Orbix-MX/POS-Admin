/**
 * Foto del producto: previsualización, subida y borrado.
 *
 * Solo aparece al editar, igual que en el web: `POST /products/:id/image`
 * necesita un producto ya creado, así que en el alta no hay nada que hacer aquí
 * — el flujo lleva al detalle en cuanto se guarda, y desde ahí se sube.
 *
 * El API se queda con una sola imagen primaria por producto (cada subida
 * reemplaza la anterior y borra su objeto en R2), por eso esto es un hueco
 * único y no una galería.
 */
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { OrbixSpinner, OrbixText, toast } from '@/components';
import { ImageIcon, TrashIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import type { ProductImage } from '@/repositories/products-repository';
import { toUserMessage } from '@/utils/error-message';
import { exceedsUploadSize, pickImageFromLibrary } from '@/utils/pick-image';

import { useDeleteProductImage, useUploadProductImage } from './use-product-mutations';

interface ProductImageFieldProps {
  productId: string;
  image: ProductImage | null;
  /** `products:edit`; sin él la foto se ve pero no se toca. */
  canEdit: boolean;
}

export function ProductImageField({ productId, image, canEdit }: ProductImageFieldProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const upload = useUploadProductImage(productId);
  const remove = useDeleteProductImage(productId);
  const busy = upload.isPending || remove.isPending;

  const handlePick = async () => {
    const asset = await pickImageFromLibrary({ aspect: [4, 3] });
    if (!asset) return;

    // El servidor también lo valida (413), pero avisar antes evita subir varios
    // MB por una red móvil para nada.
    if (exceedsUploadSize(asset)) {
      toast.error(t('products.image.tooLarge'));
      return;
    }

    upload.mutate(
      { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType },
      {
        onSuccess: () => toast.success(t('products.image.updated')),
        onError: (error) => toast.error(toUserMessage(error, t)),
      },
    );
  };

  const handleRemove = () => {
    if (!image) return;
    remove.mutate(image.id, {
      onSuccess: () => toast.success(t('products.image.removed')),
      onError: (error) => toast.error(toUserMessage(error, t)),
    });
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <OrbixText size="sm" weight="semibold" tone="mutedForeground">
        {t('products.image.label')}
      </OrbixText>

      <Pressable
        onPress={canEdit ? handlePick : undefined}
        disabled={!canEdit || busy}
        accessibilityRole="button"
        accessibilityLabel={image ? t('products.image.replace') : t('products.image.upload')}
        accessibilityState={{ disabled: !canEdit || busy }}
        // Objeto estático, no `style={({pressed}) => …}`: con nativewind +
        // React Compiler esa forma se descarta en silencio (ver `google-button.tsx`).
        style={{
          height: 168,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderStyle: image ? 'solid' : 'dashed',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          overflow: 'hidden',
        }}
      >
        {image ? (
          <Image
            // `expo-image` cachea en disco por defecto, así que volver a la
            // pantalla no repite la descarga desde R2.
            source={{ uri: image.url }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={160}
            accessibilityLabel={image.altText ?? undefined}
          />
        ) : (
          <>
            <ImageIcon size={28} color={theme.colors.mutedForeground} />
            <OrbixText size="sm" weight="semibold" tone={canEdit ? 'primary' : 'mutedForeground'}>
              {canEdit ? t('products.image.upload') : t('products.image.none')}
            </OrbixText>
          </>
        )}

        {busy ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.35)',
            }}
          >
            <OrbixSpinner size={24} color={theme.colors.onDark} />
          </View>
        ) : null}
      </Pressable>

      {image && canEdit ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Pressable
            onPress={handlePick}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('products.image.replace')}
          >
            <OrbixText size="sm" tone="primary">{t('products.image.replace')}</OrbixText>
          </Pressable>

          <Pressable
            onPress={handleRemove}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('products.image.remove')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
          >
            <TrashIcon size={13} color={theme.colors.dangerFg} />
            <OrbixText size="sm" tone="dangerFg">{t('products.image.remove')}</OrbixText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Importación masiva, una ruta para las dos entidades.
 *
 * `[entity]` y no dos pantallas: productos y clientes se importan con el mismo
 * contrato, y separarlas garantizaría que con el tiempo se comporten distinto
 * sin que nadie lo haya decidido.
 */
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixScaffold, OrbixText } from '@/components';
import { ImportScreen } from '@/features/import/import-screen';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { ImportEntity } from '@/repositories/import-repository';

/** Importar crea y actualiza: hacen falta los dos permisos, no uno. */
const PERMISSION: Record<ImportEntity, string> = {
  products: 'products:create',
  customers: 'customers:create',
};

export default function ImportRoute() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const { entity } = useLocalSearchParams<{ entity: string }>();
  const target: ImportEntity | null =
    entity === 'products' || entity === 'customers' ? entity : null;

  // Una entidad que no existe llega por enlace profundo o por una caché vieja:
  // se manda a Inicio en vez de pintar una pantalla a medias.
  if (!target) return <Redirect href="/(app)" />;
  if (!can(PERMISSION[target])) return <Redirect href="/(app)" />;

  return (
    <OrbixScaffold contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t(`import.${target}.title`)}
        </OrbixText>
      </View>

      <ImportScreen entity={target} />
    </OrbixScaffold>
  );
}

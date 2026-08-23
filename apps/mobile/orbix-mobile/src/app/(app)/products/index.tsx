/**
 * Products — list, search, and entry point to create/edit. Works across every
 * business vertical: `Product.type` (SIMPLE/SERVICE/RECIPE/COMBO) already
 * carries the per-vertical distinction server-side, so this screen doesn't
 * branch on `businessVertical` itself.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { BackButton, OrbixInput, OrbixScaffold, OrbixSkeleton, OrbixText } from '@/components';
import { PackageIcon, PlusIcon, SearchIcon } from '@/components/ui/icons';
import { useProducts } from '@/features/products/use-products';
import { useCurrencyFormatVersion } from '@/hooks/use-currency-format-version';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/repositories/products-repository';
import { currencyFormatStore } from '@/services/currency/currency-format-store';
import { ProductStatus } from '@/types/api';

const STATUS_TONE: Record<ProductStatus, 'successFg' | 'mutedForeground' | 'dangerFg'> = {
  ACTIVE: 'successFg',
  DRAFT: 'mutedForeground',
  INACTIVE: 'mutedForeground',
  ARCHIVED: 'dangerFg',
};

const formatCurrency = currencyFormatStore.format;

export default function ProductsListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canCreate = can('products:create');
  useCurrencyFormatVersion();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isFetching, error, refetch } = useProducts({ search: search || undefined, limit: 100 });

  const renderRow = ({ item }: { item: Product }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/(app)/products/[id]', params: { id: item.id } })}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: pressed ? theme.colors.muted : theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.brandBlue50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PackageIcon size={18} color={theme.colors.brandBlue600} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <OrbixText size="sm" weight="semibold" numberOfLines={1}>{item.name}</OrbixText>
        <OrbixText size="xs" tone="mutedForeground">
          {item.sku} · {t(`products.status.${item.status}`)}
        </OrbixText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <OrbixText size="sm" weight="semibold">{formatCurrency(item.price)}</OrbixText>
        <OrbixText size="xs" tone={STATUS_TONE[item.status]}>
          {item.trackInventory ? t('products.stockCount', { count: item.stock }) : t(`products.type.${item.type}`)}
        </OrbixText>
      </View>
    </Pressable>
  );

  return (
    <OrbixScaffold background="surface" contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" style={{ flex: 1 }} accessibilityRole="header">
          {t('products.title')}
        </OrbixText>
        {canCreate ? (
          <Pressable
            onPress={() => router.push('/(app)/products/new')}
            accessibilityRole="button"
            accessibilityLabel={t('products.create')}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? theme.colors.brandBlue600 : theme.colors.primary,
            })}
          >
            <PlusIcon size={18} color={theme.colors.primaryForeground} />
          </Pressable>
        ) : null}
      </View>

      <OrbixInput
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t('products.searchPlaceholder')}
        rightAdornment={<SearchIcon size={16} color={theme.colors.mutedForeground} />}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {error ? (
        <OrbixText size="sm" tone="dangerFg">{t('errors.network')}</OrbixText>
      ) : null}

      {isLoading ? (
        <View style={{ gap: theme.spacing.sm }}>
          {[0, 1, 2, 3].map((i) => (
            <OrbixSkeleton key={i} height={64} radius={theme.radius.lg} />
          ))}
        </View>
      ) : (
        <FlatList
          data={data?.products ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing['3xl'] }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing['3xl'], gap: theme.spacing.sm }}>
              <PackageIcon size={28} color={theme.colors.mutedForeground} />
              <OrbixText size="sm" tone="mutedForeground">
                {search ? t('products.noResults') : t('products.empty')}
              </OrbixText>
            </View>
          }
        />
      )}
    </OrbixScaffold>
  );
}

/**
 * Customers — list, search, and entry point to create/edit. Mirrors
 * `(app)/products/index.tsx`'s structure (debounced search, FlatList row, "+"
 * gated by `customers:create`).
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { BackButton, OrbixInput, OrbixScaffold, OrbixSkeleton, OrbixText } from '@/components';
import { Ripple, useRipple } from '@/components/animations/ripple';
import { PlusIcon, SearchIcon, UsersIcon } from '@/components/ui/icons';
import { useCustomers } from '@/features/customers/use-customers';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import type { Customer } from '@/repositories/customers-repository';
import { CustomerStatus } from '@/types/api';

const STATUS_TONE: Record<CustomerStatus, 'successFg' | 'mutedForeground' | 'dangerFg'> = {
  ACTIVE: 'successFg',
  INACTIVE: 'mutedForeground',
  BLOCKED: 'dangerFg',
};

export default function CustomersListScreen() {
  const theme = useTheme();
  const createRipple = useRipple();
  const router = useRouter();
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canCreate = can('customers:create');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isFetching, error, refetch } = useCustomers({ search: search || undefined, limit: 100 });

  const renderRow = ({ item }: { item: Customer }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/(app)/customers/[id]', params: { id: item.id } })}
      // Objeto estático, no `style={({pressed}) => …}`: con nativewind +
      // React Compiler esa forma se descarta entera y la fila perdía layout,
      // fondo y borde (ver `google-button.tsx`). `renderItem` se invoca como
      // función, no como componente, así que aquí no caben hooks para un
      // `Ripple`; el feedback se queda en el resaltado nativo de la lista.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
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
        <UsersIcon size={18} color={theme.colors.brandBlue600} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <OrbixText size="sm" weight="semibold" numberOfLines={1}>
          {item.firstName} {item.lastName}
        </OrbixText>
        <OrbixText size="xs" tone="mutedForeground" numberOfLines={1}>
          {item.company || item.email}
        </OrbixText>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <OrbixText size="xs" tone="mutedForeground">{t(`customers.type.${item.type}`)}</OrbixText>
        <OrbixText size="xs" tone={STATUS_TONE[item.status]}>{t(`customers.status.${item.status}`)}</OrbixText>
      </View>
    </Pressable>
  );

  return (
    <OrbixScaffold background="surface" contentStyle={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" style={{ flex: 1 }} accessibilityRole="header">
          {t('customers.title')}
        </OrbixText>
        {canCreate ? (
          <Pressable
            onPress={() => router.push('/(app)/customers/new')}
            accessibilityRole="button"
            accessibilityLabel={t('customers.create')}
            hitSlop={8}
            onPressIn={(event) =>
              createRipple.trigger(event.nativeEvent.locationX, event.nativeEvent.locationY)
            }
            // Objeto estático + `Ripple`, por el mismo motivo que la fila.
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              overflow: 'hidden',
            }}
          >
            <PlusIcon size={18} color={theme.colors.primaryForeground} />
            <Ripple {...createRipple} color={theme.colors.onDark} borderRadius={theme.radius.full} />
          </Pressable>
        ) : null}
      </View>

      <OrbixInput
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t('customers.searchPlaceholder')}
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
          data={data?.customers ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} tintColor={theme.colors.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: theme.spacing['3xl'] }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: theme.spacing['3xl'], gap: theme.spacing.sm }}>
              <UsersIcon size={28} color={theme.colors.mutedForeground} />
              <OrbixText size="sm" tone="mutedForeground">
                {search ? t('customers.noResults') : t('customers.empty')}
              </OrbixText>
            </View>
          }
        />
      )}
    </OrbixScaffold>
  );
}

/**
 * Content of "Datos de la tienda" — logo, commerce name, phone (with a
 * dial-code picker), and address behind a bottom sheet so the main screen
 * stays to three rows. No scaffold/back button here either; see
 * `general-panel.tsx` for why.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  FieldGroup,
  OrbixBottomSheet,
  type OrbixBottomSheetRef,
  OrbixButton,
  OrbixInput,
  OrbixSkeleton,
  OrbixText,
  OrbixTextField,
  toast,
} from '@/components';
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, ImageIcon, TrashIcon } from '@/components/ui/icons';
import { COUNTRIES, COUNTRY_DIAL_CODES, type CountryCode } from '@/constants/business-types';
import {
  pickLogoImage,
  useDeleteLogo,
  useTenantInfo,
  useUpdateTenantInfo,
  useUploadLogo,
} from '@/features/tenant/use-tenant-settings';
import { buildStoreInfoSchema, type StoreInfoFormValues } from '@/features/tenant/store-info-schema';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';

/** Reverses `composePhone`: best-effort, falls back to "no dial code guessed". */
function parsePhone(raw: string | undefined): { dialCode: CountryCode; digits: string } {
  const digitsOnly = (raw ?? '').replace(/\D/g, '');
  const last10 = digitsOnly.slice(-10);
  const prefix = digitsOnly.slice(0, digitsOnly.length - last10.length);

  const matched = (Object.entries(COUNTRY_DIAL_CODES) as [CountryCode, string][]).find(
    ([, dial]) => dial.replace('+', '') === prefix,
  );

  return { dialCode: matched?.[0] ?? 'MX', digits: last10.length === 10 ? last10 : '' };
}

function composePhone(dialCode: CountryCode, digits: string): string | undefined {
  if (!digits) return undefined;
  return `${COUNTRY_DIAL_CODES[dialCode]} ${digits}`;
}

export function StorePanel() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { isOnline } = useNetworkStatus();

  const { data: info, isLoading } = useTenantInfo();
  const updateInfo = useUpdateTenantInfo();
  const uploadLogo = useUploadLogo();
  const deleteLogo = useDeleteLogo();

  const canEdit = can('tenant:edit');
  const canBrand = can('tenant:branding');

  const countrySheetRef = useRef<OrbixBottomSheetRef>(null);
  const addressSheetRef = useRef<OrbixBottomSheetRef>(null);

  const schema = useMemo(() => buildStoreInfoSchema(t), [t]);
  const { control, handleSubmit, reset, watch, setValue } = useForm<StoreInfoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', dialCode: 'MX', phoneDigits: '', address: '' },
  });

  // The query resolves after mount — hydrate the form once real data lands,
  // instead of trying to thread an async default through `useForm`.
  useEffect(() => {
    if (!info) return;
    const { dialCode, digits } = parsePhone(info.phone);
    reset({ name: info.name, dialCode, phoneDigits: digits, address: info.address ?? '' });
  }, [info, reset]);

  const dialCode = watch('dialCode');
  const address = watch('address');

  const onSubmit = (values: StoreInfoFormValues) => {
    updateInfo.mutate(
      {
        name: values.name.trim(),
        phone: composePhone(values.dialCode, values.phoneDigits ?? ''),
        address: values.address?.trim() || undefined,
      },
      {
        onSuccess: () => toast.success(t('settings.storeUpdated')),
        onError: () => toast.error(t('errors.network')),
      },
    );
  };

  const handlePickLogo = async () => {
    const asset = await pickLogoImage();
    if (!asset) return;
    uploadLogo.mutate(asset, {
      onSuccess: () => toast.success(t('settings.logoUpdated')),
      onError: () => toast.error(t('errors.network')),
    });
  };

  const handleRemoveLogo = () => {
    deleteLogo.mutate(undefined, {
      onError: () => toast.error(t('errors.network')),
    });
  };

  if (isLoading) {
    return (
      <View style={{ gap: theme.spacing.lg }}>
        <OrbixSkeleton height={140} radius={theme.radius.xl} />
        <OrbixSkeleton height={44} radius={theme.radius.lg} />
        <OrbixSkeleton height={44} radius={theme.radius.lg} />
        <OrbixSkeleton height={44} radius={theme.radius.lg} />
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <Pressable
        onPress={canBrand ? handlePickLogo : undefined}
        disabled={!canBrand || uploadLogo.isPending}
        accessibilityRole="button"
        accessibilityLabel={t('settings.uploadLogo')}
        style={{
          height: 140,
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          overflow: 'hidden',
        }}
      >
        {info?.logoUrl ? (
          <Image source={{ uri: info.logoUrl }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        ) : (
          <>
            <ImageIcon size={28} color={theme.colors.mutedForeground} />
            <OrbixText size="sm" weight="semibold" tone={canBrand ? 'primary' : 'mutedForeground'}>
              {uploadLogo.isPending ? t('common.loading') : t('settings.uploadLogo')}
            </OrbixText>
          </>
        )}
      </Pressable>

      {info?.logoUrl && canBrand ? (
        <Pressable
          onPress={handleRemoveLogo}
          disabled={deleteLogo.isPending}
          accessibilityRole="button"
          accessibilityLabel={t('settings.removeLogo')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs, alignSelf: 'center', marginTop: -theme.spacing.md }}
        >
          <TrashIcon size={13} color={theme.colors.dangerFg} />
          <OrbixText size="sm" tone="dangerFg">{t('settings.removeLogo')}</OrbixText>
        </Pressable>
      ) : null}

      <FieldGroup>
        <OrbixTextField
          control={control}
          name="name"
          label={t('settings.storeName')}
          placeholder={t('wizard.step1.companyNamePlaceholder')}
          autoCapitalize="words"
          editable={canEdit}
        />

        <View>
          <OrbixText size="sm" weight="medium" tone="mutedForeground" style={{ marginBottom: theme.spacing.xs + 2 }}>
            {t('wizard.step1.phone')}
          </OrbixText>
          <Controller
            control={control}
            name="phoneDigits"
            render={({ field, fieldState }) => (
              <OrbixInput
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                editable={canEdit}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                maxLength={10}
                placeholder={t('wizard.step1.phonePlaceholder')}
                hasError={Boolean(fieldState.error)}
                leftAdornment={
                  <Pressable
                    onPress={() => countrySheetRef.current?.expand()}
                    disabled={!canEdit}
                    accessibilityRole="button"
                    accessibilityLabel={t('wizard.step1.country')}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <OrbixText size="md" weight="medium">{COUNTRY_DIAL_CODES[dialCode]}</OrbixText>
                    <ChevronDownIcon size={11} color={theme.colors.mutedForeground} />
                  </Pressable>
                }
              />
            )}
          />
        </View>

        <Pressable
          onPress={() => canEdit && addressSheetRef.current?.expand()}
          disabled={!canEdit}
          accessibilityRole="button"
          accessibilityLabel={t('settings.address')}
        >
          <OrbixText size="sm" weight="medium" tone="mutedForeground" style={{ marginBottom: theme.spacing.xs + 2 }}>
            {t('settings.address')}
          </OrbixText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 44,
              paddingHorizontal: theme.spacing.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
              backgroundColor: theme.colors.card,
            }}
          >
            <OrbixText size="md" tone={address ? 'foreground' : 'mutedForeground'} numberOfLines={1} style={{ flex: 1 }}>
              {address || t('settings.addressPlaceholder')}
            </OrbixText>
            <ChevronRightIcon size={12} color={theme.colors.mutedForeground} />
          </View>
        </Pressable>
      </FieldGroup>

      {!isOnline ? (
        <OrbixText size="sm" tone="mutedForeground" align="center">{t('common.offline')}</OrbixText>
      ) : null}

      <OrbixButton
        label={t('common.save')}
        onPress={handleSubmit(onSubmit)}
        disabled={!canEdit || !isOnline}
        loading={updateInfo.isPending}
      />

      <OrbixBottomSheet ref={countrySheetRef} title={t('wizard.step1.country')}>
        <View style={{ gap: 2 }}>
          {COUNTRIES.map((country) => {
            const selected = country.code === dialCode;
            return (
              <Pressable
                key={country.code}
                onPress={() => {
                  setValue('dialCode', country.code, { shouldDirty: true });
                  countrySheetRef.current?.close();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 48,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radius.lg,
                  backgroundColor: selected ? theme.colors.muted : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <OrbixText size="md" weight={selected ? 'semibold' : 'regular'}>{t(country.labelKey)}</OrbixText>
                  <OrbixText size="sm" tone="mutedForeground">{COUNTRY_DIAL_CODES[country.code]}</OrbixText>
                </View>
                {selected ? <CheckIcon size={14} color={theme.colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </OrbixBottomSheet>

      <OrbixBottomSheet ref={addressSheetRef} title={t('settings.address')}>
        <Controller
          control={control}
          name="address"
          render={({ field }) => (
            <OrbixInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t('settings.addressPlaceholder')}
              multiline
              textAlignVertical="top"
              height={88}
              autoCapitalize="sentences"
              containerStyle={{ marginBottom: theme.spacing.sm }}
            />
          )}
        />
        <OrbixButton label={t('common.done')} variant="secondary" onPress={() => addressSheetRef.current?.close()} />
      </OrbixBottomSheet>
    </View>
  );
}

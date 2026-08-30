/**
 * Wizard step 1 — company basics.
 *
 * Picking a country auto-selects its currency (and, later, its timezone), which
 * is what the prototype implies by pairing the two selects side by side.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View, type TextInput } from 'react-native';

import {
  FieldGroup,
  InlineError,
  OrbixButton,
  OrbixScaffold,
  OrbixSelect,
  OrbixText,
  OrbixTextField,
} from '@/components';
import { COUNTRIES, CURRENCIES } from '@/constants/business-types';
import { WizardHeader } from '@/features/tenant/wizard-header';
import { buildStep1Schema, type Step1Values } from '@/features/tenant/wizard-schemas';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useWizard } from '@/providers';

export default function CompanyInfoScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { draft, totalSteps, wasRestored, update, goToStep } = useWizard();
  const { session, logout } = useAuth();

  const ownerRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const schema = useMemo(() => buildStep1Schema(t), [t]);
  const { control, handleSubmit, setValue } = useForm<Step1Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: draft.companyName,
      // Pre-fills from the account so the user does not retype their own name.
      ownerName: draft.ownerName || (session?.user.fullName ?? ''),
      phone: draft.phone,
      countryCode: draft.countryCode,
      currency: draft.currency,
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const countryCode = useWatch({ control, name: 'countryCode' });

  useEffect(() => {
    const country = COUNTRIES.find((item) => item.code === countryCode);
    if (country) setValue('currency', country.currency, { shouldValidate: false });
  }, [countryCode, setValue]);

  useEffect(() => {
    goToStep(1);
    // Runs once on mount: entering this screen *is* being on step 1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countryOptions = useMemo(
    () => COUNTRIES.map((country) => ({ value: country.code, label: t(country.labelKey) })),
    [t],
  );

  const currencyOptions = useMemo(
    () => CURRENCIES.map((currency) => ({ value: currency, label: currency })),
    [],
  );

  const onSubmit = useCallback(
    (values: Step1Values) => {
      update({ ...values, step: 2 });
      router.push('/(wizard)/business-type');
    },
    [update, router],
  );

  // Step 1 is the first screen of the flow: "back" means leaving the account.
  const onBack = useCallback(() => void logout(), [logout]);

  return (
    <OrbixScaffold
      scrollable
      topPadding={theme.spacing.md}
      contentStyle={{ gap: theme.spacing.xl }}
    >
      <WizardHeader step={1} totalSteps={totalSteps} onBack={onBack} />

      <View style={{ gap: theme.spacing.xs }}>
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('wizard.step1.title')}
        </OrbixText>
        <OrbixText size="base" tone="mutedForeground">
          {t('wizard.step1.subtitle')}
        </OrbixText>
      </View>

      {wasRestored ? <InlineError message={t('wizard.draftRestored')} /> : null}

      <FieldGroup>
        <OrbixTextField
          control={control}
          name="companyName"
          label={t('wizard.step1.companyName')}
          placeholder={t('wizard.step1.companyNamePlaceholder')}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => ownerRef.current?.focus()}
        />
        <OrbixTextField
          ref={ownerRef}
          control={control}
          name="ownerName"
          label={t('wizard.step1.ownerName')}
          placeholder={t('wizard.step1.ownerNamePlaceholder')}
          autoCapitalize="words"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
        />
        <OrbixTextField
          ref={phoneRef}
          control={control}
          name="phone"
          label={t('wizard.step1.phone')}
          placeholder={t('wizard.step1.phonePlaceholder')}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={10}
          returnKeyType="done"
        />

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm + 2 }}>
          <OrbixSelect
            control={control}
            name="countryCode"
            label={t('wizard.step1.country')}
            options={countryOptions}
          />
          <OrbixSelect
            control={control}
            name="currency"
            label={t('wizard.step1.currency')}
            options={currencyOptions}
          />
        </View>
      </FieldGroup>

      <OrbixButton label={t('common.continue')} onPress={handleSubmit(onSubmit)} />
    </OrbixScaffold>
  );
}

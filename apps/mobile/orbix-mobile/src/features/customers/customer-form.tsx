/**
 * Create/edit form, shared by `(app)/customers/new.tsx` and `(app)/customers/[id].tsx`.
 * Mirrors `product-form.tsx`'s structure and conditional-field pattern
 * (`hasCredit` gates `creditLimit`/`creditDays`, same as `trackInventory` gates
 * `stock`/`lowStockAlert` in products).
 */
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import {
  FieldGroup,
  InlineError,
  OrbixButton,
  OrbixSelect,
  OrbixText,
  OrbixTextField,
  type SelectOption,
} from '@/components';
import { useTheme } from '@/hooks/use-theme';
import { CustomerStatus, CustomerType } from '@/types/api';

import { buildCustomerSchema, type CustomerFormValues } from './customer-schemas';

export interface CustomerFormProps {
  defaultValues: CustomerFormValues;
  submitLabel: string;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (values: CustomerFormValues) => void;
}

function SwitchRow({ label, hint, value, onValueChange }: { label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <View style={{ flex: 1 }}>
        <OrbixText size="sm" weight="medium">{label}</OrbixText>
        {hint ? (
          <OrbixText size="xs" tone="mutedForeground" style={{ marginTop: 2 }}>{hint}</OrbixText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.muted, true: theme.colors.brandBlue300 }}
        thumbColor={value ? theme.colors.brandBlue600 : theme.colors.card}
      />
    </View>
  );
}

export function CustomerForm({ defaultValues, submitLabel, submitting, serverError, onSubmit }: CustomerFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const schema = useMemo(() => buildCustomerSchema(t), [t]);
  const { control, handleSubmit, setValue } = useForm<CustomerFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const hasCredit = useWatch({ control, name: 'hasCredit' });

  const typeOptions = useMemo<SelectOption[]>(
    () => Object.values(CustomerType).map((value) => ({ value, label: t(`customers.type.${value}`) })),
    [t],
  );

  const statusOptions = useMemo<SelectOption[]>(
    () => Object.values(CustomerStatus).map((value) => ({ value, label: t(`customers.status.${value}`) })),
    [t],
  );

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <InlineError message={serverError} />

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('customers.sectionGeneral')}
        </OrbixText>
        <OrbixTextField
          control={control}
          name="firstName"
          label={t('customers.fields.firstName')}
          placeholder={t('customers.fields.firstNamePlaceholder')}
          autoCapitalize="words"
        />
        <OrbixTextField
          control={control}
          name="lastName"
          label={t('customers.fields.lastName')}
          placeholder={t('customers.fields.lastNamePlaceholder')}
          autoCapitalize="words"
        />
        <OrbixTextField
          control={control}
          name="email"
          label={t('customers.fields.email')}
          placeholder={t('customers.fields.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <OrbixTextField
          control={control}
          name="phone"
          label={t('customers.fields.phone')}
          placeholder={t('customers.fields.phonePlaceholder')}
          keyboardType="phone-pad"
        />
      </FieldGroup>

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('customers.sectionBusiness')}
        </OrbixText>
        <OrbixTextField
          control={control}
          name="company"
          label={t('customers.fields.company')}
          placeholder={t('customers.fields.companyPlaceholder')}
          autoCapitalize="words"
        />
        <OrbixTextField
          control={control}
          name="city"
          label={t('customers.fields.city')}
          placeholder={t('customers.fields.cityPlaceholder')}
          autoCapitalize="words"
        />
        <OrbixSelect control={control} name="type" label={t('customers.fields.type')} options={typeOptions} />
        <OrbixSelect control={control} name="status" label={t('customers.fields.status')} options={statusOptions} />
      </FieldGroup>

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('customers.sectionCredit')}
        </OrbixText>
        <SwitchRow
          label={t('customers.fields.hasCredit')}
          hint={t('customers.fields.hasCreditHint')}
          value={hasCredit}
          onValueChange={(v) => setValue('hasCredit', v, { shouldValidate: false })}
        />
        {hasCredit ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm + 2 }}>
            <View style={{ flex: 1 }}>
              <OrbixTextField control={control} name="creditLimit" label={t('customers.fields.creditLimit')} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <OrbixTextField control={control} name="creditDays" label={t('customers.fields.creditDays')} keyboardType="number-pad" />
            </View>
          </View>
        ) : null}
      </FieldGroup>

      <OrbixButton label={submitLabel} onPress={handleSubmit(onSubmit)} loading={submitting} />
    </View>
  );
}

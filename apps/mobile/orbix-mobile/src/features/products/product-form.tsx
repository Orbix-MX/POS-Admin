/**
 * Create/edit form, shared by `(app)/products/new.tsx` and `(app)/products/[id].tsx`.
 *
 * Works across every business vertical: `type` decides which fields matter —
 * stock/inventory only applies to SIMPLE, RECIPE is offered only when the
 * tenant's business config enables it (`enableRecipes`, restaurant-only, mirrors
 * the server-side gate in `ProductsService.assertRecipesEnabled`). COMBO/RECIPE
 * item editing (ingredients, bundled products) is out of scope here — this
 * screen owns the base product record only.
 */
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';

import {
  FieldGroup,
  InlineError,
  OrbixButton,
  OrbixInput,
  OrbixModal,
  OrbixSelect,
  OrbixText,
  OrbixTextField,
  type SelectOption,
} from '@/components';
import { PlusIcon } from '@/components/ui/icons';
import { useCreateCategory } from '@/features/products/use-product-mutations';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { ProductStatus, ProductType, TaxCode } from '@/types/api';
import { toUserMessage } from '@/utils/error-message';

import { buildProductSchema, type ProductFormValues } from './product-schemas';

export interface ProductFormProps {
  defaultValues: ProductFormValues;
  categoryOptions: SelectOption[];
  /** RECIPE is only meaningful for tenants with recipes enabled (restaurant). */
  allowRecipeType: boolean;
  skuEditable: boolean;
  submitLabel: string;
  submitting: boolean;
  serverError?: string | null;
  onSubmit: (values: ProductFormValues) => void;
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

export function ProductForm({
  defaultValues,
  categoryOptions,
  allowRecipeType,
  skuEditable,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
}: ProductFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const [newCategoryVisible, setNewCategoryVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const createCategory = useCreateCategory();

  const schema = useMemo(() => buildProductSchema(t), [t]);
  const { control, handleSubmit, setValue } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const type = useWatch({ control, name: 'type' });
  const trackInventory = useWatch({ control, name: 'trackInventory' });
  const isEcommerce = useWatch({ control, name: 'isEcommerce' });
  const isSimple = type === ProductType.SIMPLE;

  const typeOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = [
      { value: ProductType.SIMPLE, label: t('products.type.SIMPLE') },
      { value: ProductType.SERVICE, label: t('products.type.SERVICE') },
      { value: ProductType.COMBO, label: t('products.type.COMBO') },
    ];
    if (allowRecipeType) options.splice(1, 0, { value: ProductType.RECIPE, label: t('products.type.RECIPE') });
    return options;
  }, [allowRecipeType, t]);

  const statusOptions = useMemo<SelectOption[]>(
    () => Object.values(ProductStatus).map((value) => ({ value, label: t(`products.status.${value}`) })),
    [t],
  );

  const taxCodeOptions = useMemo<SelectOption[]>(
    () => Object.values(TaxCode).map((value) => ({ value, label: t(`products.taxCode.${value}`) })),
    [t],
  );

  const categorySelectOptions = useMemo<SelectOption[]>(
    () => [{ value: '', label: t('products.noCategory') }, ...categoryOptions],
    [categoryOptions, t],
  );

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    createCategory.mutate(
      { name },
      {
        onSuccess: (category) => {
          setValue('categoryId', category.id, { shouldValidate: false });
          setNewCategoryVisible(false);
          setNewCategoryName('');
        },
      },
    );
  };

  return (
    <View style={{ gap: theme.spacing.xl }}>
      <InlineError message={serverError} />

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('products.sectionGeneral')}
        </OrbixText>
        <OrbixSelect control={control} name="type" label={t('products.fields.type')} options={typeOptions} />
        <OrbixTextField
          control={control}
          name="sku"
          label={t('products.fields.sku')}
          placeholder={t('products.fields.skuPlaceholder')}
          autoCapitalize="characters"
          editable={skuEditable}
        />
        <OrbixTextField
          control={control}
          name="name"
          label={t('products.fields.name')}
          placeholder={t('products.fields.namePlaceholder')}
          autoCapitalize="sentences"
        />
        <OrbixTextField
          control={control}
          name="description"
          label={t('products.fields.description')}
          placeholder={t('products.fields.descriptionPlaceholder')}
          multiline
          numberOfLines={3}
          height={80}
        />
      </FieldGroup>

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('products.sectionPricing')}
        </OrbixText>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm + 2 }}>
          <View style={{ flex: 1 }}>
            <OrbixTextField control={control} name="price" label={t('products.fields.price')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <OrbixTextField control={control} name="comparePrice" label={t('products.fields.comparePrice')} keyboardType="decimal-pad" />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm + 2 }}>
          <View style={{ flex: 1 }}>
            <OrbixTextField control={control} name="costPrice" label={t('products.fields.costPrice')} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <OrbixTextField control={control} name="taxRate" label={t('products.fields.taxRate')} keyboardType="decimal-pad" />
          </View>
        </View>
        <OrbixSelect control={control} name="taxCode" label={t('products.fields.taxCode')} options={taxCodeOptions} />
      </FieldGroup>

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('products.sectionCategory')}
        </OrbixText>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm + 2 }}>
          <View style={{ flex: 1 }}>
            <OrbixSelect control={control} name="categoryId" label={t('products.fields.category')} options={categorySelectOptions} />
          </View>
          {can('categories:create') ? (
            <Pressable
              onPress={() => setNewCategoryVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('products.newCategory')}
              style={{
                width: 44,
                height: 44,
                borderRadius: theme.radius.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PlusIcon size={18} color={theme.colors.primary} />
            </Pressable>
          ) : null}
        </View>
      </FieldGroup>

      <OrbixModal
        visible={newCategoryVisible}
        title={t('products.newCategory')}
        confirmLabel={t('products.createCategory')}
        cancelLabel={t('common.cancel')}
        loading={createCategory.isPending}
        onConfirm={handleCreateCategory}
        onDismiss={() => {
          setNewCategoryVisible(false);
          setNewCategoryName('');
        }}
      >
        <View style={{ gap: theme.spacing.sm }}>
          <InlineError message={createCategory.error ? toUserMessage(createCategory.error, t) : null} />
          <OrbixInput
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder={t('products.newCategoryPlaceholder')}
            autoFocus
            autoCapitalize="sentences"
          />
        </View>
      </OrbixModal>

      {isSimple ? (
        <FieldGroup>
          <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('products.sectionInventory')}
          </OrbixText>
          <SwitchRow
            label={t('products.fields.trackInventory')}
            hint={t('products.fields.trackInventoryHint')}
            value={trackInventory}
            onValueChange={(v) => setValue('trackInventory', v, { shouldValidate: false })}
          />
          {trackInventory ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm + 2 }}>
              <View style={{ flex: 1 }}>
                <OrbixTextField control={control} name="stock" label={t('products.fields.stock')} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <OrbixTextField control={control} name="lowStockAlert" label={t('products.fields.lowStockAlert')} keyboardType="number-pad" />
              </View>
            </View>
          ) : null}
        </FieldGroup>
      ) : null}

      <FieldGroup>
        <OrbixText size="xs" weight="semibold" tone="mutedForeground" style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {t('products.sectionVisibility')}
        </OrbixText>
        <OrbixSelect control={control} name="status" label={t('products.fields.status')} options={statusOptions} />
        <SwitchRow
          label={t('products.fields.isEcommerce')}
          hint={t('products.fields.isEcommerceHint')}
          value={isEcommerce}
          onValueChange={(v) => setValue('isEcommerce', v, { shouldValidate: false })}
        />
      </FieldGroup>

      <OrbixButton label={submitLabel} onPress={handleSubmit(onSubmit)} loading={submitting} />
    </View>
  );
}

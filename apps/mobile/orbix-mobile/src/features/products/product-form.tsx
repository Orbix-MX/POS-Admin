/**
 * Create/edit form, shared by `(app)/products/new.tsx` and `(app)/products/[id].tsx`.
 *
 * Works across every business vertical: `type` decides which fields matter —
 * stock/inventory only applies to SIMPLE, RECIPE is offered only when the
 * tenant's business config enables it (`enableRecipes`, restaurant-only, mirrors
 * the server-side gate in `ProductsService.assertRecipesEnabled`). COMBO/RECIPE
 * item editing (ingredients, bundled products) is out of scope here — this
 * screen owns the base product record only.
 *
 * Wizard, not one long scroll: the five sections below (`STEP_IDS`) map 1:1 to
 * the pre-existing `products.section*` i18n labels, each gated by the fields
 * that actually belong to it.
 *
 * Two navigation modes, picked by `isEditing`:
 * - Create (`isEditing` false): guided — `trigger()` validates only the
 *   current step's fields before advancing via "Continuar", Guardar only
 *   appears on the last step. A blank record benefits from being walked
 *   through in order.
 * - Edit (`isEditing` true): free — a row of numbered, tappable dots jumps
 *   straight to any step (1→4 in one tap), no per-step validation gate, and
 *   Guardar is available from every step. An existing record is already
 *   complete; forcing a full replay of the wizard to fix one field would be
 *   the opposite of "cleaner screen". Whole-record validation still runs on
 *   submit either way (`zodResolver`), so this can't save invalid data.
 */
import { useMemo, useState } from 'react';
import { useForm, useWatch, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';

import {
  BackButton,
  FieldGroup,
  InlineError,
  OrbixButton,
  OrbixInput,
  OrbixModal,
  OrbixSelect,
  OrbixStepper,
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
  /** Editing an existing product → free step navigation, no gating. See file header. */
  isEditing?: boolean;
}

/**
 * Numbered, tappable step dots — the free-navigation header used only in
 * edit mode. The dot itself is drawn small (28px) to stay visually light,
 * but the actual touch target is padded out to the ~44dp minimum via
 * `hitSlop` — at 28px raw, adjacent dots are close enough that a real
 * fingertip reliably lands on the wrong one.
 */
function StepDots({
  total,
  current,
  onSelect,
}: {
  total: number
  current: number
  onSelect: (index: number) => void
}) {
  const theme = useTheme();
  const dotSize = 28;
  const hitSlop = 8; // (28 + 8*2) = 44dp effective target — the touch guideline minimum
  return (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      {Array.from({ length: total }, (_, index) => {
        const active = index === current;
        return (
          <Pressable
            key={index}
            onPress={() => onSelect(index)}
            hitSlop={hitSlop}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={String(index + 1)}
            style={({ pressed }) => ({
              width: dotSize,
              height: dotSize,
              borderRadius: theme.radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? theme.colors.primary : theme.colors.card,
              borderWidth: 1,
              borderColor: active ? theme.colors.primary : theme.colors.border,
              opacity: pressed ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.9 : 1 }],
            })}
          >
            <OrbixText size="xs" weight="semibold" style={{ color: active ? theme.colors.primaryForeground : theme.colors.mutedForeground }}>
              {index + 1}
            </OrbixText>
          </Pressable>
        );
      })}
    </View>
  );
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

// One step per `products.section*` label already in the locale files —
// see the file-level comment for why the split lands here.
const STEP_IDS = ['general', 'pricing', 'category', 'inventory', 'visibility'] as const;
type StepId = (typeof STEP_IDS)[number];

/** Fields validated before leaving a step — keeps `trigger()` scoped per step. */
const STEP_FIELDS: Record<StepId, FieldPath<ProductFormValues>[]> = {
  general: ['type', 'sku', 'name', 'description'],
  pricing: ['price', 'comparePrice', 'costPrice', 'taxRate', 'taxCode'],
  category: ['categoryId'],
  inventory: ['trackInventory', 'stock', 'lowStockAlert'],
  visibility: ['status', 'isEcommerce'],
};

/** `products.section*` — same labels the fields used to sit under in one long scroll. */
const STEP_TITLE_KEYS: Record<StepId, 'products.sectionGeneral' | 'products.sectionPricing' | 'products.sectionCategory' | 'products.sectionInventory' | 'products.sectionVisibility'> = {
  general: 'products.sectionGeneral',
  pricing: 'products.sectionPricing',
  category: 'products.sectionCategory',
  inventory: 'products.sectionInventory',
  visibility: 'products.sectionVisibility',
};

export function ProductForm({
  defaultValues,
  categoryOptions,
  allowRecipeType,
  skuEditable,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
  isEditing = false,
}: ProductFormProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const [newCategoryVisible, setNewCategoryVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const createCategory = useCreateCategory();

  const schema = useMemo(() => buildProductSchema(t), [t]);
  const { control, handleSubmit, setValue, trigger } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  const type = useWatch({ control, name: 'type' });
  const trackInventory = useWatch({ control, name: 'trackInventory' });
  const isEcommerce = useWatch({ control, name: 'isEcommerce' });
  const isSimple = type === ProductType.SIMPLE;

  const [stepIndex, setStepIndex] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const stepId: StepId = STEP_IDS[stepIndex] ?? STEP_IDS[0];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEP_IDS.length - 1;

  const goNext = async () => {
    setAdvancing(true);
    const valid = await trigger(STEP_FIELDS[stepId]);
    setAdvancing(false);
    if (valid) setStepIndex((i) => Math.min(STEP_IDS.length - 1, i + 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  // Edit mode: no validation gate — the record already exists and is already
  // valid, jumping straight to step 4 to fix one field shouldn't require
  // re-passing steps 1-3 first. Whole-record validation still runs on submit.
  const jumpToStep = (index: number) => setStepIndex(index);

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
      <View style={{ gap: theme.spacing.lg }}>
        {isEditing ? (
          <>
            <StepDots total={STEP_IDS.length} current={stepIndex} onSelect={jumpToStep} />
            <OrbixText size="sm" weight="semibold" tone="mutedForeground">
              {t(STEP_TITLE_KEYS[stepId])}
            </OrbixText>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              {isFirstStep ? null : <BackButton onPress={goBack} accessibilityLabel={t('common.back')} size={32} />}
              <OrbixText size="sm" weight="semibold" tone="mutedForeground">
                {t('wizard.stepLabel', { current: String(stepIndex + 1), total: String(STEP_IDS.length) })}
                {'  ·  '}
                {t(STEP_TITLE_KEYS[stepId])}
              </OrbixText>
            </View>
            <OrbixStepper
              current={stepIndex + 1}
              total={STEP_IDS.length}
              accessibilityLabel={t('a11y.progress', {
                current: String(stepIndex + 1),
                total: String(STEP_IDS.length),
              })}
            />
          </>
        )}
      </View>

      <InlineError message={serverError} />

      {stepId === 'general' ? (
        <FieldGroup>
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
      ) : null}

      {stepId === 'pricing' ? (
        <FieldGroup>
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
      ) : null}

      {stepId === 'category' ? (
        <FieldGroup>
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
      ) : null}

      {stepId === 'inventory' ? (
        <FieldGroup>
          {isSimple ? (
            <>
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
            </>
          ) : (
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.colors.muted,
              }}
            >
              <OrbixText size="xs" tone="mutedForeground">
                {t(type === ProductType.SERVICE ? 'products.serviceInventoryHint' : 'products.nonSimpleInventoryHint')}
              </OrbixText>
            </View>
          )}
        </FieldGroup>
      ) : null}

      {stepId === 'visibility' ? (
        <FieldGroup>
          <OrbixSelect control={control} name="status" label={t('products.fields.status')} options={statusOptions} />
          <SwitchRow
            label={t('products.fields.isEcommerce')}
            hint={t('products.fields.isEcommerceHint')}
            value={isEcommerce}
            onValueChange={(v) => setValue('isEcommerce', v, { shouldValidate: false })}
          />
        </FieldGroup>
      ) : null}

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

      {isEditing || isLastStep ? (
        <OrbixButton label={submitLabel} onPress={handleSubmit(onSubmit)} loading={submitting} />
      ) : (
        <OrbixButton label={t('common.continue')} onPress={goNext} loading={advancing} />
      )}
    </View>
  );
}

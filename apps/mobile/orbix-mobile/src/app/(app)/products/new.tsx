import { Redirect, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixScaffold, OrbixText } from '@/components';
import { EMPTY_PRODUCT_FORM, toCreateRequest, type ProductFormValues } from '@/features/products/product-schemas';
import { ProductForm } from '@/features/products/product-form';
import { useCreateProduct } from '@/features/products/use-product-mutations';
import { useCategories } from '@/features/products/use-products';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

export default function NewProductScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { session } = useAuth();
  const { can } = usePermissions();

  const { data: categories } = useCategories();
  const categoryOptions = useMemo(
    () => (categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const create = useCreateProduct();

  const handleSubmit = (values: ProductFormValues) => {
    create.mutate(toCreateRequest(values), {
      onSuccess: (product) => {
        router.replace({ pathname: '/(app)/products/[id]', params: { id: product.id } });
      },
    });
  };

  // Deep-link / stale-cache defense: the "+" that gets here is already hidden
  // for roles without `products:create`, this just covers direct navigation.
  if (!can('products:create')) {
    return <Redirect href="/(app)/products" />;
  }

  return (
    <OrbixScaffold scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('products.create')}
        </OrbixText>
      </View>

      <ProductForm
        defaultValues={EMPTY_PRODUCT_FORM}
        categoryOptions={categoryOptions}
        allowRecipeType={Boolean(session?.capabilities?.businessFeatures.enableRecipes)}
        skuEditable
        submitLabel={t('products.create')}
        submitting={create.isPending}
        serverError={create.error ? toUserMessage(create.error, t) : null}
        onSubmit={handleSubmit}
      />
    </OrbixScaffold>
  );
}

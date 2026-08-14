import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton, OrbixScaffold, OrbixText } from '@/components';
import { CustomerForm } from '@/features/customers/customer-form';
import { EMPTY_CUSTOMER_FORM, toCreateRequest, type CustomerFormValues } from '@/features/customers/customer-schemas';
import { useCreateCustomer } from '@/features/customers/use-customer-mutations';
import { usePermissions } from '@/hooks/use-permissions';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

export default function NewCustomerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const create = useCreateCustomer();

  const handleSubmit = (values: CustomerFormValues) => {
    create.mutate(toCreateRequest(values), {
      onSuccess: (customer) => {
        router.replace({ pathname: '/(app)/customers/[id]', params: { id: customer.id } });
      },
    });
  };

  // Deep-link / stale-cache defense: the "+" that gets here is already hidden
  // for roles without `customers:create`, this just covers direct navigation.
  if (!can('customers:create')) {
    return <Redirect href="/(app)/customers" />;
  }

  return (
    <OrbixScaffold background="surface" scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" accessibilityRole="header">
          {t('customers.create')}
        </OrbixText>
      </View>

      <CustomerForm
        defaultValues={EMPTY_CUSTOMER_FORM}
        submitLabel={t('customers.create')}
        submitting={create.isPending}
        serverError={create.error ? toUserMessage(create.error, t) : null}
        onSubmit={handleSubmit}
      />
    </OrbixScaffold>
  );
}

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { BackButton, OrbixLoading, OrbixModal, OrbixScaffold, OrbixText, toast } from '@/components';
import { TrashIcon } from '@/components/ui/icons';
import { CustomerForm } from '@/features/customers/customer-form';
import { toUpdateRequest, type CustomerFormValues } from '@/features/customers/customer-schemas';
import { useDeleteCustomer, useUpdateCustomer } from '@/features/customers/use-customer-mutations';
import { useCustomer } from '@/features/customers/use-customers';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/utils/error-message';

function numToStr(value: number | null): string {
  return value === null ? '' : String(value);
}

export default function EditCustomerScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: customer, isLoading } = useCustomer(id);

  const update = useUpdateCustomer(id);
  const remove = useDeleteCustomer();

  const defaultValues = useMemo<CustomerFormValues | null>(() => {
    if (!customer) return null;
    return {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone ?? '',
      company: customer.company ?? '',
      city: customer.city ?? '',
      type: customer.type as CustomerFormValues['type'],
      status: customer.status as CustomerFormValues['status'],
      hasCredit: customer.hasCredit,
      creditLimit: numToStr(customer.creditLimit),
      creditDays: String(customer.creditDays),
    };
  }, [customer]);

  const handleSubmit = (values: CustomerFormValues) => {
    update.mutate(toUpdateRequest(values), {
      onSuccess: () => toast.success(t('customers.updated')),
    });
  };

  const handleDelete = () => {
    remove.mutate(id, {
      onSuccess: () => {
        setConfirmDelete(false);
        router.back();
      },
      onError: (error) => {
        setConfirmDelete(false);
        toast.error(toUserMessage(error, t));
      },
    });
  };

  if (isLoading || !defaultValues) {
    return <OrbixLoading />;
  }

  return (
    <OrbixScaffold background="surface" scrollable contentStyle={{ gap: theme.spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BackButton onPress={() => router.back()} accessibilityLabel={t('a11y.back')} />
        <OrbixText size="xl" weight="bold" numberOfLines={1} style={{ flex: 1 }} accessibilityRole="header">
          {customer?.firstName} {customer?.lastName}
        </OrbixText>
        <Pressable
          onPress={() => setConfirmDelete(true)}
          accessibilityRole="button"
          accessibilityLabel={t('customers.delete')}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: theme.radius.full,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.dangerBg,
          }}
        >
          <TrashIcon size={16} color={theme.colors.dangerFg} />
        </Pressable>
      </View>

      <CustomerForm
        defaultValues={defaultValues}
        submitLabel={t('common.continue')}
        submitting={update.isPending}
        serverError={update.error ? toUserMessage(update.error, t) : null}
        onSubmit={handleSubmit}
      />

      <OrbixModal
        visible={confirmDelete}
        title={t('customers.deleteConfirmTitle')}
        description={t('customers.deleteConfirmDescription', { name: `${customer?.firstName} ${customer?.lastName}` })}
        confirmLabel={t('customers.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={remove.isPending}
        onConfirm={handleDelete}
        onDismiss={() => setConfirmDelete(false)}
      />
    </OrbixScaffold>
  );
}

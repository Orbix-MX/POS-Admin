/**
 * Business-type catalog for the wizard.
 *
 * `initialData` is the locally cached (or bundled) list, so the grid paints
 * instantly and never shows a spinner; the query then syncs in the background.
 */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import type { BusinessType } from '@/models/business-type';
import { businessTypeRepository } from '@/repositories/business-type-repository';
import { queryKeys } from '@/services/query/query-keys';
import { translateKey } from '@/utils/translate';

export interface DisplayBusinessType extends BusinessType {
  /** Backend label when available, otherwise the local translation. */
  displayLabel: string;
}

export function useBusinessTypes() {
  const { t } = useTranslation();

  const query = useQuery({
    queryKey: queryKeys.catalogs.businessTypes(),
    queryFn: () => businessTypeRepository.fetch(),
    initialData: () => businessTypeRepository.getCached(),
    // The catalog changes at most a few times a year.
    staleTime: 24 * 60 * 60 * 1000,
  });

  const items: DisplayBusinessType[] = query.data.map((item) => ({
    ...item,
    displayLabel: item.label ?? translateKey(t, item.labelKey, item.id),
  }));

  return { ...query, items };
}

export function useBusinessType(id: string | undefined): DisplayBusinessType | undefined {
  const { items } = useBusinessTypes();
  if (!id) return undefined;
  return items.find((item) => item.id === id);
}

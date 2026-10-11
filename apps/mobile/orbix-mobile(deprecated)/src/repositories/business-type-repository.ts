/**
 * Business-type catalog with transparent remote sync.
 *
 * Order of preference: cached remote catalog → freshly fetched remote catalog →
 * bundled local list. The wizard therefore works today (local list) and starts
 * using the server's list the moment `GET /catalogs/business-types` ships,
 * without a client release.
 */
import { StorageKeys } from '@/constants/storage-keys';
import { LOCAL_BUSINESS_TYPES } from '@/constants/business-types';
import type { BusinessTypeCatalogDto } from '@/dto/onboarding.dto';
import type { BusinessType } from '@/models/business-type';
import { ApiError, http } from '@/services/api';
import { kvStorage } from '@/services/storage/kv-storage';

interface CachedCatalog {
  version: string;
  items: BusinessType[];
}

function toBusinessType(dto: BusinessTypeCatalogDto['items'][number]): BusinessType {
  return {
    id: dto.id,
    icon: dto.icon,
    // The API localizes server-side; keep a key as fallback for older payloads.
    labelKey: `businessTypes.${dto.id}`,
    label: dto.label,
    businessVertical: dto.businessVertical,
    businessProfile: dto.businessProfile,
    sortOrder: dto.sortOrder,
  };
}

export const businessTypeRepository = {
  /** Synchronous read for first paint — never hits the network. */
  getCached(): BusinessType[] {
    const cached = kvStorage.getJson<CachedCatalog>(StorageKeys.businessTypes);
    if (cached?.items.length) return cached.items;
    return [...LOCAL_BUSINESS_TYPES];
  },

  /**
   * Fetches the remote catalog, caching it on success.
   *
   * A 404 is the expected answer until the endpoint exists, so it is swallowed
   * and the local catalog is returned — this is a sync, not a hard dependency.
   * Any other failure propagates so React Query can retry it.
   */
  async fetch(): Promise<BusinessType[]> {
    try {
      const dto = await http.get<BusinessTypeCatalogDto>('/catalogs/business-types');
      const items = dto.items.map(toBusinessType).sort((a, b) => a.sortOrder - b.sortOrder);
      kvStorage.setJson(StorageKeys.businessTypes, { version: dto.version, items });
      return items;
    } catch (error) {
      // TODO(backend): remove this fallback once GET /catalogs/business-types exists.
      if (error instanceof ApiError && (error.kind === 'notFound' || error.kind === 'network')) {
        return businessTypeRepository.getCached();
      }
      throw error;
    }
  },
} as const;

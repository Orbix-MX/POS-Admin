import type { BusinessProfile, BusinessVertical } from '@/types/api';

/** A card in the "Tipo de negocio" step of the company wizard. */
export interface BusinessType {
  id: string;
  /** Emoji shown on the card, matching the Claude Design prototype. */
  icon: string;
  /** i18n key; resolved at render time so the catalog stays language-agnostic. */
  labelKey: string;
  /** Pre-localized label from the backend; wins over `labelKey` when present. */
  label?: string;
  businessVertical: BusinessVertical;
  businessProfile: BusinessProfile;
  sortOrder: number;
}

/**
 * Mutations for the wizard's remote steps: phone verification and tenant
 * creation.
 *
 * All three call endpoints that do not exist yet, so they reject with
 * `NotImplementedError`. The screens handle that explicitly (see
 * `src/features/tenant/onboarding-availability.ts`) instead of pretending the
 * call succeeded.
 */
import { useMutation } from '@tanstack/react-query';

import { COUNTRIES, COUNTRY_DIAL_CODES, type CountryCode } from '@/constants/business-types';
import type {
  CreateTenantOnboardingResponseDto,
  SendPhoneCodeResponseDto,
  VerifyPhoneCodeResponseDto,
} from '@/dto/onboarding.dto';
import { useBusinessType } from '@/features/business/use-business-types';
import { onboardingRepository } from '@/repositories/onboarding-repository';

import type { WizardDraft } from './wizard-schemas';

/** Builds the E.164 number the API expects from the 10 local digits. */
export function toE164(phone: string, countryCode: string): string {
  const dial = COUNTRY_DIAL_CODES[countryCode as CountryCode] ?? '+52';
  return `${dial}${phone.replace(/\D/g, '')}`;
}

export function useSendPhoneCode() {
  return useMutation<SendPhoneCodeResponseDto, unknown, { phone: string; countryCode: string }>({
    mutationFn: ({ phone, countryCode }) =>
      onboardingRepository.sendPhoneCode({ phone: toE164(phone, countryCode) }),
  });
}

export function useVerifyPhoneCode() {
  return useMutation<VerifyPhoneCodeResponseDto, unknown, { verificationId: string; code: string }>(
    {
      mutationFn: (input) => onboardingRepository.verifyPhoneCode(input),
    },
  );
}

export function useCreateTenant(draft: WizardDraft) {
  const businessType = useBusinessType(draft.businessTypeId);

  return useMutation<CreateTenantOnboardingResponseDto, unknown, void>({
    mutationFn: () => {
      if (!businessType) {
        throw new Error('A business type must be selected before creating the tenant.');
      }
      const country = COUNTRIES.find((item) => item.code === draft.countryCode);

      return onboardingRepository.createTenant({
        name: draft.companyName.trim(),
        ownerName: draft.ownerName.trim(),
        phone: toE164(draft.phone, draft.countryCode),
        countryCode: draft.countryCode,
        currency: draft.currency,
        timezone: country?.timezone ?? 'America/Mexico_City',
        businessVertical: businessType.businessVertical,
        businessProfile: businessType.businessProfile,
        businessTypeId: businessType.id,
      });
    },
  });
}

/**
 * Repository for the self-service onboarding endpoints.
 *
 * `createTenant` is wired to a real backend endpoint. The rest still target
 * endpoints the Orbix API does not expose yet — each throws
 * `NotImplementedError` carrying the exact route the backend must add. The
 * full request/response contract is documented in `src/dto/onboarding.dto.ts`.
 */
import type {
  CreateTenantOnboardingRequestDto,
  CreateTenantOnboardingResponseDto,
  SendPhoneCodeRequestDto,
  SendPhoneCodeResponseDto,
  VerifyPhoneCodeRequestDto,
  VerifyPhoneCodeResponseDto,
} from '@/dto/onboarding.dto';
import { http, NotImplementedError } from '@/services/api';

/** Flip to `true` per endpoint as the backend ships them. */
export const ONBOARDING_ENDPOINTS_AVAILABLE = {
  phoneVerification: false,
  tenantOnboarding: true,
} as const;

export const onboardingRepository = {

  /**
   * TODO(backend): `POST /api/auth/phone/send-code` (Bearer).
   * Contract: {@link SendPhoneCodeRequestDto} → {@link SendPhoneCodeResponseDto}
   */
  async sendPhoneCode(_request: SendPhoneCodeRequestDto): Promise<SendPhoneCodeResponseDto> {
    throw new NotImplementedError(
      'POST /auth/phone/send-code',
      'no SMS provider is wired into the API yet.',
    );
    // return http.post<SendPhoneCodeResponseDto>('/auth/phone/send-code', _request);
  },

  /**
   * TODO(backend): `POST /api/auth/phone/verify-code` (Bearer).
   * Contract: {@link VerifyPhoneCodeRequestDto} → {@link VerifyPhoneCodeResponseDto}
   */
  async verifyPhoneCode(_request: VerifyPhoneCodeRequestDto): Promise<VerifyPhoneCodeResponseDto> {
    throw new NotImplementedError(
      'POST /auth/phone/verify-code',
      'no SMS provider is wired into the API yet.',
    );
    // return http.post<VerifyPhoneCodeResponseDto>('/auth/phone/verify-code', _request);
  },

  /**
   * `POST /api/tenants/onboarding` (Bearer, any authenticated user without a
   * tenant yet). Provisions the company on the FREE plan with only the
   * essentials: name, vertical, main branch and Owner membership/role.
   *
   * Contract: {@link CreateTenantOnboardingRequestDto} →
   * {@link CreateTenantOnboardingResponseDto}
   */
  async createTenant(
    request: CreateTenantOnboardingRequestDto,
  ): Promise<CreateTenantOnboardingResponseDto> {
    return http.post<CreateTenantOnboardingResponseDto>('/tenants/onboarding', request);
  },
} as const;

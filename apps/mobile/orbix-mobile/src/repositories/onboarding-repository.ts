/**
 * Repository for the self-service onboarding endpoints.
 *
 * ⚠️  Every method here targets an endpoint that the Orbix API does **not**
 * expose yet. Rather than mocking a response — which would make a broken flow
 * look like a working one — each method throws `NotImplementedError` carrying
 * the exact route the backend must add. The full request/response contract is
 * documented in `src/dto/onboarding.dto.ts`.
 *
 * The call sites are already wired, so implementing the backend is a matter of
 * deleting the guard clause and uncommenting the `http.*` line below it.
 */
import type {
  CreateTenantOnboardingRequestDto,
  CreateTenantOnboardingResponseDto,
  GoogleSignInRequestDto,
  GoogleSignInResponseDto,
  SendPhoneCodeRequestDto,
  SendPhoneCodeResponseDto,
  VerifyPhoneCodeRequestDto,
  VerifyPhoneCodeResponseDto,
} from '@/dto/onboarding.dto';
import { NotImplementedError } from '@/services/api';

/** Flip to `true` per endpoint as the backend ships them. */
export const ONBOARDING_ENDPOINTS_AVAILABLE = {
  googleSignIn: false,
  phoneVerification: false,
  tenantOnboarding: false,
} as const;

export const onboardingRepository = {
  /**
   * TODO(backend): `POST /api/auth/google`.
   * Contract: {@link GoogleSignInRequestDto} → {@link GoogleSignInResponseDto}
   * (identical to `/auth/login`, so the session handling is already written).
   */
  async signInWithGoogle(_request: GoogleSignInRequestDto): Promise<GoogleSignInResponseDto> {
    throw new NotImplementedError(
      'POST /auth/google',
      'the API has no OAuth provider configured. See src/dto/onboarding.dto.ts for the expected contract.',
    );
    // return http.post<GoogleSignInResponseDto>('/auth/google', _request);
  },

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
   * TODO(backend): `POST /api/tenants/onboarding` (Bearer, any authenticated user).
   *
   * `POST /api/tenants` already creates a tenant but is guarded by
   * `@Roles('SUPER_ADMIN')` and does not create the owner membership, the
   * default branch or the role seed — so it cannot serve this flow as-is.
   *
   * Contract: {@link CreateTenantOnboardingRequestDto} →
   * {@link CreateTenantOnboardingResponseDto}
   */
  async createTenant(
    _request: CreateTenantOnboardingRequestDto,
  ): Promise<CreateTenantOnboardingResponseDto> {
    throw new NotImplementedError(
      'POST /tenants/onboarding',
      'POST /tenants exists but requires SUPER_ADMIN and skips membership/branch/role seeding.',
    );
    // return http.post<CreateTenantOnboardingResponseDto>('/tenants/onboarding', _request);
  },
} as const;

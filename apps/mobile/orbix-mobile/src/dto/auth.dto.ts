/**
 * Wire contracts for `@Controller('auth')`
 * (`pos-admin/api/src/modules/core/auth/auth.controller.ts`).
 *
 * These are the *transport* shapes — snake/camel exactly as the API emits them.
 * Screens consume the domain models in `src/models/` instead, which the
 * repositories map to; that keeps a backend rename from rippling into the UI.
 */
import type {
  BusinessProfile,
  BusinessVertical,
  PosOperationMode,
  TenantFeature,
  TenantPlan,
  TenantRole,
  UserRole,
  UserStatus,
} from '@/types/api';

/* ── Requests ────────────────────────────────────────────────────────────── */

/** `POST /auth/register` — the API splits the name into first/last. */
export interface RegisterRequestDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** `POST /auth/login` */
export interface LoginRequestDto {
  email: string;
  password: string;
}

/** `POST /auth/refresh` */
export interface RefreshRequestDto {
  refreshToken: string;
}

/** `POST /auth/logout` — body is optional; omitting it revokes only the access token. */
export interface LogoutRequestDto {
  refreshToken?: string;
}

/* ── Responses ───────────────────────────────────────────────────────────── */

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  googleLinked: boolean;
  hasPassword: boolean;
  mfaEnabled: boolean;
}

export interface TenantSummaryDto {
  id: string;
  name: string;
  slug: string;
  memberRole: TenantRole;
  plan: TenantPlan;
}

/**
 * `POST /auth/register`, `POST /auth/login`, `POST /auth/google` and
 * `POST /auth/mfa/verify` all answer with this shape.
 *
 * `accessToken`/`user` are absent exactly when `mfaRequired` is `true` — the
 * caller has a correct password (or Google identity) but the session isn't
 * minted yet until `POST /auth/mfa/verify` clears the second factor.
 */
export interface AuthResponseDto {
  accessToken?: string;
  /** Opaque rotating refresh token — only issued to mobile clients. */
  refreshToken?: string;
  user?: UserResponseDto;
  /** Present when the user resolves to exactly one tenant. */
  tenant?: TenantSummaryDto;
  availableTenants?: TenantSummaryDto[];
  /** `true` when a second factor is still needed — see `MfaVerifyRequestDto`. */
  mfaRequired?: boolean;
  /** One-time ticket to send back with the code to `POST /auth/mfa/verify`. */
  mfaTicket?: string;
}

/** `POST /auth/mfa/verify` — second step of login when `mfaRequired` came back true. */
export interface MfaVerifyRequestDto {
  mfaTicket: string;
  code: string;
}

/** `POST /auth/mfa/setup` — authenticated; generates a new TOTP secret, not yet active. */
export interface MfaSetupResponseDto {
  secret: string;
  otpauthUrl: string;
}

/** `POST /auth/mfa/confirm` — activates MFA once the first code checks out. */
export interface MfaConfirmRequestDto {
  code: string;
}

export interface MfaConfirmResponseDto {
  backupCodes: string[];
}

/** `POST /auth/mfa/disable` — requires a valid TOTP/backup code. */
export interface MfaDisableRequestDto {
  code: string;
}

/** `POST /auth/google/link-start` — authenticated; ticket for `POST /auth/google` (`linkTicket`). */
export interface GoogleLinkStartResponseDto {
  token: string;
}

/** `POST /auth/forgot-password` — public; same response whether or not the email exists. */
export interface ForgotPasswordRequestDto {
  email: string;
}

export interface RefreshResponseDto {
  accessToken: string;
  refreshToken: string;
}

export interface UserRoleDto {
  id: string;
  name: string;
  description?: string;
  color?: string;
  permissions: string[];
}

/** `GET /auth/me` */
export interface ProfileResponseDto {
  user: UserResponseDto;
  currentTenant?: TenantSummaryDto;
  currentBranchId?: string;
  roles?: UserRoleDto[];
  permissions?: string[];
}

/** Capability flags the API derives from `businessProfile`. */
export type BusinessFeaturesDto = Record<string, boolean>;

/** `PATCH /auth/select-tenant/:slug` */
export interface SelectTenantResponseDto {
  accessToken: string;
  posOnly: boolean;
  plan: TenantPlan;
  enabledModules: string[];
  businessVertical: BusinessVertical;
  businessProfile: BusinessProfile;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];
  businessFeatures: BusinessFeaturesDto;
  tenant: TenantSummaryDto;
}

/** `PATCH /auth/select-branch/:branchId` */
export interface SelectBranchResponseDto {
  accessToken: string;
  branchId: string;
}

/** `GET /auth/me/capabilities` */
export interface CapabilitiesResponseDto {
  plan: TenantPlan;
  enabledModules: string[];
  effectiveModules: string[];
  /** `null` means unlimited. */
  maxUsers: number | null;
  activeUsers: number;
  overUserLimit: boolean;
  businessVertical: BusinessVertical;
  businessProfile: BusinessProfile;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];
  businessFeatures: BusinessFeaturesDto;
}

/**
 * Auth/session contract shared with the NestJS API.
 * Mirrors `api/src/modules/core/auth/dto/auth-response.dto.ts`.
 *
 * Domain enums (TenantPlan, BusinessVertical, …) are imported from the shared
 * `@orbix/types` workspace package — see `src/types/index.ts` — to avoid
 * duplicating them across api / web / mobile.
 */
import type {
  TenantPlan,
  BusinessVertical,
  PosOperationMode,
  TenantFeature,
} from '@orbix/types';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: string;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  memberRole: string;
  plan: TenantPlan;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  isMain: boolean;
  status: string;
  city?: string | null;
  address?: string | null;
}

/** `POST /auth/login` and `POST /auth/register`. */
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  tenant?: TenantSummary;
  availableTenants?: TenantSummary[];
}

/** `POST /auth/refresh`. */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/** `PATCH /auth/select-tenant/:slug`. */
export interface SelectTenantResponse {
  accessToken: string;
  posOnly: boolean;
  plan: TenantPlan;
  enabledModules: string[];
  businessVertical: BusinessVertical;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];
  tenant: TenantSummary;
}

/** `PATCH /auth/select-branch/:branchId`. */
export interface SelectBranchResponse {
  accessToken: string;
  branchId: string;
}

export interface UserRoleSummary {
  id: string;
  name: string;
  description?: string;
  color?: string;
  permissions: string[];
}

/** `GET /auth/me`. */
export interface ProfileResponse {
  user: AuthUser;
  currentTenant?: TenantSummary;
  currentBranchId?: string;
  roles?: UserRoleSummary[];
  permissions?: string[];
}

/** `GET /auth/me/capabilities`. */
export interface CapabilitiesResponse {
  plan: TenantPlan;
  enabledModules: string[];
  effectiveModules: string[];
  maxUsers: number | null;
  activeUsers: number;
  overUserLimit: boolean;
  businessVertical: BusinessVertical;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];
}

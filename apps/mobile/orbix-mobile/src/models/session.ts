/**
 * Domain models consumed by hooks and screens.
 *
 * Deliberately narrower than the DTOs: the UI never needs `createdAt` on the
 * user, and it should not care that the API splits the name into two fields.
 */
import type {
  BusinessProfile,
  BusinessVertical,
  PosOperationMode,
  TenantFeature,
  TenantPlan,
  TenantRole,
  UserRole,
} from '@/types/api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** `firstName lastName`, pre-joined for display. */
  fullName: string;
  role: UserRole;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  memberRole: TenantRole;
  plan: TenantPlan;
}

/** Capabilities of the currently selected tenant. */
export interface TenantCapabilities {
  plan: TenantPlan;
  enabledModules: string[];
  businessVertical: BusinessVertical;
  businessProfile: BusinessProfile;
  posOperationMode: PosOperationMode;
  enabledFeatures: TenantFeature[];
  businessFeatures: Record<string, boolean>;
  /** True when the user's permissions are entirely inside the POS subset. */
  posOnly: boolean;
}

/**
 * The whole authenticated state. `tenant` is undefined between login and
 * tenant selection — the API's two-step flow makes that a legitimate state,
 * not an error.
 */
export interface Session {
  user: AuthUser;
  tenant?: TenantSummary;
  branchId?: string;
  availableTenants: TenantSummary[];
  capabilities?: TenantCapabilities;
  /** Flat permission keys, e.g. `products:create`. Empty until a tenant is picked. */
  permissions: string[];
  roles: { id: string; name: string; permissions: string[] }[];
}

export type AuthStatus =
  | 'loading' // reading tokens from the keychain
  | 'unauthenticated'
  | 'authenticated'; // token valid; `session.tenant` may still be undefined

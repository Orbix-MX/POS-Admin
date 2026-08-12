/**
 * The only module that knows the shape of the `/auth` endpoints.
 *
 * Everything above this layer speaks in `src/models` types; everything below is
 * transport. That boundary is what lets the two-step tenant selection stay an
 * implementation detail of the auth flow rather than leaking into screens.
 */
import type {
  AuthResponseDto,
  CapabilitiesResponseDto,
  LoginRequestDto,
  ProfileResponseDto,
  RefreshResponseDto,
  RegisterRequestDto,
  SelectBranchResponseDto,
  SelectTenantResponseDto,
  UserResponseDto,
  TenantSummaryDto,
} from '@/dto/auth.dto';
import type { AuthUser, Session, TenantCapabilities, TenantSummary } from '@/models/session';
import { http } from '@/services/api';

/* ── Mappers ─────────────────────────────────────────────────────────────── */

function toAuthUser(dto: UserResponseDto): AuthUser {
  return {
    id: dto.id,
    email: dto.email,
    firstName: dto.firstName,
    lastName: dto.lastName,
    fullName: `${dto.firstName} ${dto.lastName}`.trim(),
    role: dto.role,
  };
}

function toTenantSummary(dto: TenantSummaryDto): TenantSummary {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    memberRole: dto.memberRole,
    plan: dto.plan,
  };
}

function toCapabilities(
  dto: SelectTenantResponseDto | CapabilitiesResponseDto,
  posOnly: boolean,
): TenantCapabilities {
  return {
    plan: dto.plan,
    enabledModules: dto.enabledModules,
    businessVertical: dto.businessVertical,
    businessProfile: dto.businessProfile,
    posOperationMode: dto.posOperationMode,
    enabledFeatures: dto.enabledFeatures,
    businessFeatures: dto.businessFeatures,
    posOnly,
  };
}

/* ── Results ─────────────────────────────────────────────────────────────── */

export interface AuthResult {
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser;
  tenant?: TenantSummary;
  availableTenants: TenantSummary[];
}

function toAuthResult(dto: AuthResponseDto): AuthResult {
  return {
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken ?? null,
    user: toAuthUser(dto.user),
    tenant: dto.tenant ? toTenantSummary(dto.tenant) : undefined,
    availableTenants: (dto.availableTenants ?? []).map(toTenantSummary),
  };
}

export interface SelectTenantResult {
  accessToken: string;
  tenant: TenantSummary;
  capabilities: TenantCapabilities;
}

export interface RegisterInput {
  /** Full name as typed; split here because the API stores two columns. */
  name: string;
  email: string;
  password: string;
}

/** Splits "Ana María Pérez" into first + last, keeping the remainder together. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');
  // The API requires `lastName` to be at least 2 characters; repeat the first
  // name when the user only gave one word rather than failing validation.
  return { firstName, lastName: lastName.length >= 2 ? lastName : firstName };
}

export const authRepository = {
  async register(input: RegisterInput): Promise<AuthResult> {
    const { firstName, lastName } = splitName(input.name);
    const body: RegisterRequestDto = {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      firstName,
      lastName,
    };
    return toAuthResult(await http.post<AuthResponseDto>('/auth/register', body));
  },

  async login(input: LoginRequestDto): Promise<AuthResult> {
    const body: LoginRequestDto = {
      email: input.email.trim().toLowerCase(),
      password: input.password,
    };
    return toAuthResult(await http.post<AuthResponseDto>('/auth/login', body));
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return http.post<RefreshResponseDto>('/auth/refresh', { refreshToken });
  },

  async logout(refreshToken: string | null): Promise<void> {
    await http.post('/auth/logout', refreshToken ? { refreshToken } : {});
  },

  /** `GET /auth/me` — the source of truth on cold start. */
  async getProfile(): Promise<Session> {
    const dto = await http.get<ProfileResponseDto>('/auth/me');
    return {
      user: toAuthUser(dto.user),
      tenant: dto.currentTenant ? toTenantSummary(dto.currentTenant) : undefined,
      branchId: dto.currentBranchId,
      availableTenants: dto.currentTenant ? [toTenantSummary(dto.currentTenant)] : [],
      permissions: dto.permissions ?? [],
      roles: (dto.roles ?? []).map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions,
      })),
    };
  },

  async selectTenant(slug: string): Promise<SelectTenantResult> {
    const dto = await http.patch<SelectTenantResponseDto>(`/auth/select-tenant/${slug}`);
    return {
      accessToken: dto.accessToken,
      tenant: toTenantSummary(dto.tenant),
      capabilities: toCapabilities(dto, dto.posOnly),
    };
  },

  async selectBranch(branchId: string): Promise<SelectBranchResponseDto> {
    return http.patch<SelectBranchResponseDto>(`/auth/select-branch/${branchId}`);
  },

  async getCapabilities(posOnly = false): Promise<TenantCapabilities> {
    const dto = await http.get<CapabilitiesResponseDto>('/auth/me/capabilities');
    return toCapabilities(dto, posOnly);
  },
} as const;

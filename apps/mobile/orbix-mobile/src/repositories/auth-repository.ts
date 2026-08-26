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
  MfaConfirmResponseDto,
  MfaSetupResponseDto,
  ProfileResponseDto,
  RefreshResponseDto,
  RegisterRequestDto,
  SelectBranchResponseDto,
  SelectTenantResponseDto,
  UserResponseDto,
  TenantSummaryDto,
} from '@/dto/auth.dto';
import type { GoogleSignInRequestDto } from '@/dto/onboarding.dto';
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
    googleLinked: dto.googleLinked,
    hasPassword: dto.hasPassword,
    mfaEnabled: dto.mfaEnabled,
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

/** `dto.user`/`dto.accessToken` are guaranteed present once `mfaRequired` has been ruled out. */
function toAuthResult(dto: AuthResponseDto & { accessToken: string; user: UserResponseDto }): AuthResult {
  return {
    accessToken: dto.accessToken,
    refreshToken: dto.refreshToken ?? null,
    user: toAuthUser(dto.user),
    tenant: dto.tenant ? toTenantSummary(dto.tenant) : undefined,
    availableTenants: (dto.availableTenants ?? []).map(toTenantSummary),
  };
}

/** The API cuts a login (password or Google) short here when the account has MFA on. */
export interface MfaRequiredResult {
  mfaRequired: true;
  mfaTicket: string;
}

export type LoginOutcome = AuthResult | MfaRequiredResult;

/** Narrows the wire shape once, so every login path shares the same branch. */
function toLoginOutcome(dto: AuthResponseDto): LoginOutcome {
  if (dto.mfaRequired) {
    if (!dto.mfaTicket) throw new Error('API respondió mfaRequired sin mfaTicket.');
    return { mfaRequired: true, mfaTicket: dto.mfaTicket };
  }
  if (!dto.accessToken || !dto.user) {
    throw new Error('Respuesta de login incompleta: falta accessToken o user.');
  }
  return toAuthResult(dto as AuthResponseDto & { accessToken: string; user: UserResponseDto });
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
    const outcome = toLoginOutcome(await http.post<AuthResponseDto>('/auth/register', body));
    if ('mfaRequired' in outcome) {
      // No debería pasar — una cuenta recién creada no tiene MFA activo.
      throw new Error('El servidor pidió MFA en un registro nuevo.');
    }
    return outcome;
  },

  async login(input: LoginRequestDto): Promise<LoginOutcome> {
    const body: LoginRequestDto = {
      email: input.email.trim().toLowerCase(),
      password: input.password,
    };
    return toLoginOutcome(await http.post<AuthResponseDto>('/auth/login', body));
  },

  /** `POST /auth/google` — PKCE, ver `src/dto/onboarding.dto.ts` para el contrato completo. */
  async googleSignIn(request: GoogleSignInRequestDto): Promise<LoginOutcome> {
    return toLoginOutcome(await http.post<AuthResponseDto>('/auth/google', request));
  },

  /** Segundo paso del login cuando `mfaRequired` vino en `true`. */
  async verifyMfa(mfaTicket: string, code: string): Promise<AuthResult> {
    const dto = await http.post<AuthResponseDto>('/auth/mfa/verify', { mfaTicket, code });
    const outcome = toLoginOutcome(dto);
    if ('mfaRequired' in outcome) {
      // No debería pasar — el servidor no vuelve a pedir MFA tras verificarlo.
      throw new Error('El servidor volvió a pedir MFA después de verificarlo.');
    }
    return outcome;
  },

  /** `POST /auth/mfa/setup` — genera un secreto TOTP nuevo, aún no activo. */
  async setupMfa(): Promise<MfaSetupResponseDto> {
    return http.post<MfaSetupResponseDto>('/auth/mfa/setup');
  },

  /** `POST /auth/mfa/confirm` — confirma el setup con el primer código y activa MFA. */
  async confirmMfa(code: string): Promise<MfaConfirmResponseDto> {
    return http.post<MfaConfirmResponseDto>('/auth/mfa/confirm', { code });
  },

  /** `POST /auth/mfa/disable` — requiere un código válido. */
  async disableMfa(code: string): Promise<void> {
    await http.post('/auth/mfa/disable', { code });
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

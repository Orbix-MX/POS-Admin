import { AuthService } from './auth.service';

/**
 * Fase 1 (orbix-mobile) — `AuthService.googleMobileSignIn` es el punto que
 * conecta el perfil ya verificado de Google (o el resultado de vincular) con
 * la MISMA sesión que el resto de los caminos de login — incluida la
 * ramificación de MFA vía `completeLogin`.
 */

const TENANT = {
  id: 't1',
  name: 'Tenant',
  slug: 'tenant',
  plan: 'FREE',
  status: 'ACTIVE',
};

function buildUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'ana@example.com',
    status: 'ACTIVE',
    googleId: null,
    mfaEnabled: false,
    tenantMemberships: [{ tenantId: TENANT.id, role: 'STAFF', tenant: TENANT }],
    ...overrides,
  };
}

function buildService({ user, googleLinkConsume }: { user: ReturnType<typeof buildUser>; googleLinkConsume?: jest.Mock }) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string; googleId?: string; email?: string } }) => {
        if (where.googleId !== undefined) return Promise.resolve(where.googleId === user.googleId ? user : null);
        if (where.email !== undefined) return Promise.resolve(where.email === user.email ? user : null);
        return Promise.resolve(where.id === user.id ? user : null);
      }),
      update: jest.fn().mockResolvedValue(user),
    },
  };

  const service = new AuthService(
    prisma as never,
    { sign: jest.fn().mockReturnValue('token') } as never,
    { get: jest.fn() } as never,
    { revoke: jest.fn() } as never,
    { issue: jest.fn().mockResolvedValue('refresh') } as never,
    { create: jest.fn() } as never,
    { issue: jest.fn(), consume: googleLinkConsume ?? jest.fn() } as never,
    { issueChallenge: jest.fn().mockResolvedValue('mfa-ticket'), verifyChallenge: jest.fn() } as never,
    { getCapacity: jest.fn() } as never,
    { getStatus: jest.fn() } as never,
  );

  return { service, prisma };
}

const PROFILE = {
  googleId: 'g-123',
  email: 'ana@example.com',
  emailVerified: true,
  firstName: 'Ana',
  lastName: 'Pérez',
};

describe('AuthService.googleMobileSignIn — login (sin linkTicket)', () => {
  it('resuelve por googleId ya vinculado y arma la sesión completa', async () => {
    const user = buildUser({ googleId: PROFILE.googleId });
    const { service } = buildService({ user });

    const result = await service.googleMobileSignIn(PROFILE);

    expect(result.accessToken).toBe('token');
    expect(result.mfaRequired).toBeUndefined();
  });

  it('con MFA activo, corta a un desafío en vez de emitir la sesión', async () => {
    const user = buildUser({ googleId: PROFILE.googleId, mfaEnabled: true });
    const { service } = buildService({ user });

    const result = await service.googleMobileSignIn(PROFILE);

    expect(result.mfaRequired).toBe(true);
    expect(result.mfaTicket).toBe('mfa-ticket');
    expect(result.accessToken).toBeUndefined();
  });

  it('sin googleId vinculado pero con el mismo correo, auto-vincula y entra', async () => {
    const user = buildUser({ googleId: null });
    const { service, prisma } = buildService({ user });

    const result = await service.googleMobileSignIn(PROFILE);

    expect(result.accessToken).toBe('token');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ googleId: PROFILE.googleId }) }),
    );
  });
});

describe('AuthService.googleMobileSignIn — vincular (con linkTicket)', () => {
  it('vincula vía el ticket y arma la sesión SIN pasar por el desafío de MFA', async () => {
    const user = buildUser({ googleId: null, mfaEnabled: true });
    const consume = jest.fn().mockResolvedValue(user.id);
    const { service } = buildService({ user, googleLinkConsume: consume });

    const result = await service.googleMobileSignIn(PROFILE, 'raw-link-ticket');

    expect(consume).toHaveBeenCalledWith('raw-link-ticket');
    expect(result.accessToken).toBe('token');
    expect(result.mfaRequired).toBeUndefined();
  });
});

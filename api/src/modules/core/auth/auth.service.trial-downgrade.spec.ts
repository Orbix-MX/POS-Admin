import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../database/prisma.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { LicenseService } from '../../../common/services/license.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { OAuthTicketService } from './services/oauth-ticket.service';
import { GoogleLinkTicketService } from './services/google-link-ticket.service';
import { MfaService } from './services/mfa.service';

/**
 * @odd prueba-alta-self-service T-001
 *
 * `select-tenant` cuando la validación de la licencia acaba de terminar la prueba del
 * alta. La membresía se carga antes de validar; sin releer el tenant, la respuesta y
 * el token salían con `plan: PRO` aunque la empresa ya estuviera en FREE (visto con
 * la API arrancada, S-A de `orbix-mobile/docs/odd/alta-empresa.md`).
 */

const tenantRow = (plan: 'PRO' | 'FREE', status: 'TRIAL' | 'ACTIVE') => ({
  id: 'tenant-1',
  name: 'Prueba',
  slug: 'prueba',
  plan,
  status,
  enabledModules: [],
  businessVertical: 'RETAIL',
  businessProfile: 'RETAIL',
  posOperationMode: 'STANDARD',
  enabledFeatures: [],
});

async function build(validation: Record<string, unknown>) {
  const prisma = {
    tenantMembership: {
      findFirst: jest.fn().mockResolvedValue({
        tenantId: 'tenant-1',
        role: 'OWNER',
        status: 'ACTIVE',
        tenant: tenantRow('PRO', 'TRIAL'),
      }),
    },
    tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(tenantRow('FREE', 'ACTIVE')) },
    user: { update: jest.fn().mockResolvedValue({}) },
    userRoleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    userPermission: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const jwt = { sign: jest.fn().mockReturnValue('token') };
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: jwt },
      { provide: ConfigService, useValue: { get: jest.fn() } },
      { provide: RefreshTokenService, useValue: {} },
      {
        provide: LicenseService,
        useValue: { validateLicense: jest.fn().mockResolvedValue(validation), reasonMessage: jest.fn() },
      },
      { provide: PlanLimitsService, useValue: {} },
      { provide: OAuthTicketService, useValue: {} },
      { provide: GoogleLinkTicketService, useValue: {} },
      { provide: MfaService, useValue: {} },
      { provide: TokenBlacklistService, useValue: {} },
    ],
  }).compile();
  return { service: module.get(AuthService), prisma, jwt };
}

describe('AuthService.selectTenant — fin de la prueba del alta', () => {
  it('si la validación bajó el tenant a FREE, el token y la respuesta salen en FREE', async () => {
    const { service, prisma, jwt } = await build({ valid: true, status: 'ACTIVE', tenantChanged: true });

    const result = await service.selectTenant('user-1', 'ana@test.com', 'prueba');

    expect(prisma.tenant.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    expect(result.plan).toBe('FREE');
    expect(result.tenant.plan).toBe('FREE');
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ plan: 'FREE' }));
  });

  it('sin cambios en la validación no hace la consulta extra', async () => {
    const { service, prisma } = await build({ valid: true, status: 'TRIAL' });

    const result = await service.selectTenant('user-1', 'ana@test.com', 'prueba');

    expect(prisma.tenant.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(result.plan).toBe('PRO');
  });
});

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
 * @odd planes-self-service T-001
 *
 * `GET /auth/me/capabilities` (S-B): la app necesita saber si la empresa está en prueba,
 * hasta cuándo y qué pasa al terminar, para el aviso "te quedan N días". El plan sale de
 * la base y no del JWT: un token emitido antes de que terminara la prueba seguiría
 * diciendo PRO.
 */

const tenantRow = (overrides: Record<string, unknown>) => ({
  businessVertical: 'RETAIL',
  businessProfile: 'RETAIL',
  posOperationMode: 'QUICK_SALE',
  enabledFeatures: [],
  enabledModules: [],
  plan: 'PRO',
  status: 'TRIAL',
  trialEndsAt: new Date('2026-10-25T00:00:00.000Z'),
  settings: {},
  ...overrides,
});

async function build(tenant: Record<string, unknown>) {
  const prisma = { tenant: { findUnique: jest.fn().mockResolvedValue(tenant) } };
  const module = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: {} },
      { provide: ConfigService, useValue: { get: jest.fn() } },
      { provide: RefreshTokenService, useValue: {} },
      { provide: LicenseService, useValue: {} },
      {
        provide: PlanLimitsService,
        useValue: { getCapacity: jest.fn().mockResolvedValue({ maxUsers: 5, activeUsers: 1, overUserLimit: false }) },
      },
      { provide: OAuthTicketService, useValue: {} },
      { provide: GoogleLinkTicketService, useValue: {} },
      { provide: MfaService, useValue: {} },
      { provide: TokenBlacklistService, useValue: {} },
    ],
  }).compile();
  return module.get(AuthService);
}

describe('AuthService.getCapabilities — prueba', () => {
  it('prueba del alta: TRIAL, fin de la prueba y que al terminar baja a FREE', async () => {
    const service = await build(tenantRow({ settings: { selfServiceTrial: true } }));

    const caps = await service.getCapabilities('PRO', [], 'tenant-1');

    expect(caps).toMatchObject({
      plan: 'PRO',
      status: 'TRIAL',
      trialEndsAt: '2026-10-25T00:00:00.000Z',
      trialEndsTo: 'FREE',
    });
  });

  it('prueba dada desde Platform: al terminar expira', async () => {
    const service = await build(tenantRow({}));

    const caps = await service.getCapabilities('PRO', [], 'tenant-1');

    expect(caps.trialEndsTo).toBe('EXPIRE');
  });

  it('fuera de prueba no hay fin de prueba, y el plan es el de la base aunque el token diga otro', async () => {
    const service = await build(tenantRow({ plan: 'FREE', status: 'ACTIVE', settings: { selfServiceTrial: true } }));

    const caps = await service.getCapabilities('PRO', [], 'tenant-1');

    expect(caps).toMatchObject({ plan: 'FREE', status: 'ACTIVE', trialEndsAt: null, trialEndsTo: null });
    expect(caps.effectiveModules).not.toContain('insumos');
  });

  it('sin tenant no expone estado de prueba', async () => {
    const service = await build(tenantRow({}));

    const caps = await service.getCapabilities('FREE', []);

    expect(caps).not.toHaveProperty('status');
    expect(caps).not.toHaveProperty('trialEndsAt');
  });
});

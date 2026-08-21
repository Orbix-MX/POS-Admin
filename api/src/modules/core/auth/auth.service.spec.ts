import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { RefreshTokenService } from './services/refresh-token.service';
import { LicenseService } from '../../../common/services/license.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { TokenBlacklistService } from './services/token-blacklist.service';
import { OAuthTicketService } from './services/oauth-ticket.service';

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'jwt.secret') return 'test-secret';
      if (key === 'jwt.expiresIn') return '7d';
      if (key === 'jwt.refreshExpiresInDays') return 30;
      return null;
    }),
  };

  const mockOAuthTicketService = {
    issue: jest.fn().mockResolvedValue('test-ticket'),
    consume: jest.fn(),
    purgeExpired: jest.fn(),
  };

  const mockRefreshTokenService = {
    issue: jest.fn().mockResolvedValue('test-refresh-token'),
    rotate: jest.fn(),
    revokeByRaw: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const mockLicenseService = {
    validateLicense: jest.fn().mockResolvedValue({ valid: true }),
    reasonMessage: jest.fn().mockReturnValue('license'),
  };

  const mockPlanLimitsService = {
    getCapacity: jest.fn(),
    getBranchCapacity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OAuthTicketService, useValue: mockOAuthTicketService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RefreshTokenService, useValue: mockRefreshTokenService },
        { provide: LicenseService, useValue: mockLicenseService },
        { provide: PlanLimitsService, useValue: mockPlanLimitsService },
        { provide: TokenBlacklistService, useValue: { isBlacklisted: jest.fn().mockResolvedValue(false), add: jest.fn(), revoke: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const hashedPassword = 'hashed-password';
      const mockUser = {
        id: '1',
        email: registerDto.email,
        password: hashedPassword,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'STAFF',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('test-token');
      jest.spyOn(PasswordUtil, 'hash').mockResolvedValue(hashedPassword);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(registerDto.email);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });

    it('should throw ConflictException if email exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should login user with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: loginDto.email,
        password: 'hashed-password',
        firstName: 'Test',
        lastName: 'User',
        role: 'STAFF',
        status: 'ACTIVE',
        // El login filtra las membresías por estado del tenant.
        tenantMemberships: [
          { tenantId: 'tenant-1', role: 'STAFF', tenant: { id: 'tenant-1', slug: 'demo', name: 'Demo', status: 'ACTIVE' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('test-token');
      jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      const loginDto = {
        email: 'invalid@example.com',
        password: 'password123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        id: '1',
        email: loginDto.email,
        password: 'hashed-password',
        status: 'ACTIVE',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        id: '1',
        email: loginDto.email,
        password: 'hashed-password',
        status: 'INACTIVE',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(PasswordUtil, 'compare').mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'STAFF',
        status: 'ACTIVE',
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastTenantSelectedId: null,
        lastBranchSelectedId: null,
        lastTenantSelected: null,
        tenantMemberships: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile(userId);

      expect(result.user.id).toBe(userId);
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

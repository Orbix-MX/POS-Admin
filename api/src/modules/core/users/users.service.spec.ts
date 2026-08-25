import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../../database/prisma.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { PermissionCacheService } from '../../../common/cache/permission-cache.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { AuditService } from '../../../common/services/audit.service';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // El alta de usuario crea también su membresía de tenant.
    tenantMembership: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      // La protección de "último administrador" consulta las membresías activas;
      // por defecto queda otro admin, así que no bloquea estos tests.
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'otro-admin',
          user: { role: 'SUPER_ADMIN', roleAssignments: [], permissionGrants: [] },
        },
      ]),
    },
    userRoleAssignment: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    userPermissionGrant: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    permission: { findMany: jest.fn().mockResolvedValue([]) },
    // `getOwnerUserId` lo consulta para saber a quién no se puede desactivar.
    tenant: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
      typeof cb === 'function' ? cb(mockPrismaService) : Promise.all(cb),
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PlanLimitsService, useValue: { assertCanAddUser: jest.fn(), assertCanAddActiveUser: jest.fn(), recomputeOverLimit: jest.fn(), getUsage: jest.fn() } },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: TenantContextService, useValue: { requireTenantId: () => 'tenant-1', getBranchId: () => null } },
        { provide: AuditContextService, useValue: { getUserId: () => 'actor-1', isOperator: () => false } },
        {
          provide: EffectivePermissionsService,
          useValue: {
            getFor: jest.fn().mockResolvedValue([]),
            assertActorCanGrant: jest.fn(),
            keysForRoles: jest.fn().mockResolvedValue([]),
            assertTenantKeepsAnAdmin: jest.fn(),
            countAdmins: jest.fn().mockResolvedValue(1),
          },
        },
        {
          provide: PermissionCacheService,
          useValue: { invalidateUser: jest.fn(), invalidateTenant: jest.fn(), get: jest.fn(), set: jest.fn() },
        },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
      };

      const mockUser = {
        id: '1',
        ...createUserDto,
        password: 'hashed-password',
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        tenantMemberships: [{ status: 'ACTIVE' }],
        updatedAt: new Date(),
      };

      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(mockUser);
      jest.spyOn(PasswordUtil, 'hash').mockResolvedValue('hashed-password');

      const result = await service.create(createUserDto);

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(createUserDto.email);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('si el correo ya pertenece a esta empresa, rechaza por duplicado', async () => {
      const createUserDto = {
        email: 'existing@example.com',
        password: 'Password1234',
        firstName: 'Test',
        lastName: 'User',
      };

      // La cuenta existe y ya es miembro de este tenant.
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1', status: 'ACTIVE' });
      mockPrismaService.tenantMembership.findUnique.mockResolvedValue({ status: 'ACTIVE' });

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const paginationDto = { page: 1, limit: 10, skip: 0 };
      const mockUsers = [
        {
          id: '1',
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          role: 'STAFF',
          status: 'ACTIVE',
          password: 'hashed',
          createdAt: new Date(),
          tenantMemberships: [{ status: 'ACTIVE' }],
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.user.findMany.mockResolvedValue(mockUsers);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.findAll(paginationDto);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
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
        tenantMemberships: [{ status: 'ACTIVE' }],
        updatedAt: new Date(),
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.findOne(userId);

      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe(userId);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const userId = '1';
      const updateDto = { firstName: 'Updated' };
      const mockUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'STAFF',
        status: 'ACTIVE',
        password: 'hashed',
        createdAt: new Date(),
        tenantMemberships: [{ status: 'ACTIVE' }],
        updatedAt: new Date(),
      };

      const updatedUser = { ...mockUser, firstName: 'Updated' };

      // El servicio comprueba existencia y luego relee el registro ya escrito.
      mockPrismaService.user.findFirst
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValue(updatedUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(userId, updateDto);

      expect(result.firstName).toBe('Updated');
      expect(result).not.toHaveProperty('password');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.update('invalid-id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('da de baja la membresía en el tenant, sin borrar la cuenta', async () => {
      const userId = '1';
      const mockUser = {
        id: userId,
        email: 'test@example.com',
      };

      mockPrismaService.user.findFirst.mockResolvedValue(mockUser);
      mockPrismaService.tenantMembership.update.mockResolvedValue({ status: 'INACTIVE' });

      await service.remove(userId);

      expect(mockPrismaService.tenantMembership.update).toHaveBeenCalledWith({
        where: { tenantId_userId: { tenantId: 'tenant-1', userId } },
        data: { status: 'INACTIVE' },
      });
      // La cuenta sobrevive: borrarla anularía la autoría de su historial de
      // negocio (onDelete: SetNull) y sus accesos en otros tenants.
      expect(mockPrismaService.user.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

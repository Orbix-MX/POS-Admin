import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { AuditService } from '../../../common/services/audit.service';
import { EffectivePermissionsService } from '../../../common/services/effective-permissions.service';
import { PlanLimitsService } from '../../../common/services/plan-limits.service';
import { PasswordUtil } from '../../../common/utils/password.util';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Employee, EmployeeStatus } from '@prisma/client';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/** Cuenta de back-office vinculada, tal como se devuelve al cliente. */
export interface LinkedAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

/** Employee without the secret PIN hash; exposes only whether a PIN is set. */
export type PublicEmployee = Omit<Employee, 'pinHash'> & {
  hasPin: boolean;
  user?: LinkedAccount | null;
};

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
    private audit: AuditService,
    private effectivePermissions: EffectivePermissionsService,
    private planLimits: PlanLimitsService,
  ) {}

  /** Never leak the PIN hash to clients; surface a boolean instead. */
  private sanitize(e: Employee & { user?: LinkedAccount | null }): PublicEmployee {
    const { pinHash, ...rest } = e;
    return { ...rest, hasPin: pinHash != null };
  }

  /** Campos de la cuenta vinculada que el cliente necesita mostrar. */
  private static readonly LINKED_ACCOUNT_SELECT = {
    select: { id: true, email: true, firstName: true, lastName: true },
  };

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<PublicEmployee>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page } = paginationDto;
    const where = { tenantId };

    const [employees, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: EmployeesService.LINKED_ACCOUNT_SELECT },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return {
      data: employees.map((e) => this.sanitize(e)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<PublicEmployee> {
    const tenantId = this.tenantContext.requireTenantId();
    const employee = await this.prisma.employee.findFirst({
      where: { id, tenantId },
      include: { user: EmployeesService.LINKED_ACCOUNT_SELECT },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.sanitize(employee);
  }

  /**
   * Resolves the back-office account this employee should be linked to.
   *
   * Two mutually exclusive routes: link an account that already exists, or
   * create one. Returns `null` when the employee gets no account, which is the
   * common case — most staff only ever use a PIN.
   */
  private async resolveLinkedAccount(
    tenantId: string,
    dto: CreateEmployeeDto,
  ): Promise<string | null> {
    if (dto.userId && dto.createUserAccount) {
      throw new BadRequestException(
        'Elige una sola opción: vincular una cuenta existente o crear una nueva.',
      );
    }

    if (dto.userId) return this.assertLinkableAccount(tenantId, dto.userId);
    if (!dto.createUserAccount) return null;

    // Creating an account is a `users:create` action reached through the
    // employees endpoint. Without this check, `employees:create` alone would be
    // a side door for handing out access to the back-office.
    if (!(await this.effectivePermissions.actorHas('users:create'))) {
      throw new ForbiddenException(
        'No tienes permiso para crear cuentas de acceso (users:create).',
      );
    }

    if (!dto.userPassword) {
      throw new BadRequestException(
        'Falta la contraseña inicial de la cuenta (userPassword).',
      );
    }

    // The account's email is the employee's, so both identities stay in sync;
    // it is unique across the platform, not per tenant.
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(
        'Ya existe una cuenta con ese correo. Vincúlala en lugar de crear una nueva.',
      );
    }

    await this.planLimits.assertCanAddActiveUser(tenantId);

    const password = await PasswordUtil.hash(dto.userPassword);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'STAFF',
        status: 'ACTIVE',
        // No roles are assigned here on purpose: an account starts with no
        // permissions and someone with roles:edit grants them deliberately.
        tenantMemberships: { create: { tenantId, role: 'STAFF', status: 'ACTIVE' } },
      },
    });

    await this.audit.log({
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, role: user.role, createdFrom: 'employee' },
    });

    return user.id;
  }

  /** An account can only be linked if it belongs to the current tenant. */
  private async assertLinkableAccount(tenantId: string, userId: string): Promise<string> {
    // Scoping by membership is what stops an id from another company being
    // linked here — the same IDOR that existed in user role assignment.
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { userId: true },
    });
    if (!membership) {
      throw new BadRequestException('Esa cuenta no pertenece a esta empresa.');
    }

    const taken = await this.prisma.employee.findFirst({
      where: { tenantId, userId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (taken) {
      throw new ConflictException(
        `Esa cuenta ya está vinculada a ${taken.firstName} ${taken.lastName}.`,
      );
    }

    return userId;
  }

  async create(dto: CreateEmployeeDto): Promise<PublicEmployee> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const byNumber = await this.prisma.employee.findUnique({
      where: { tenantId_employeeNumber: { tenantId, employeeNumber: dto.employeeNumber } },
    });
    if (byNumber) throw new ConflictException('Employee number already exists');

    const byEmail = await this.prisma.employee.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (byEmail) throw new ConflictException('Email already registered');

    const linkedUserId = await this.resolveLinkedAccount(tenantId, dto);

    const created = await this.prisma.employee.create({
      data: {
        tenantId,
        userId: linkedUserId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone ?? null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        curp: dto.curp ?? null,
        rfc: dto.rfc ?? null,
        department: dto.department ?? null,
        position: dto.position ?? null,
        contractType: dto.contractType ?? 'FULL_TIME',
        hireDate: dto.hireDate ? new Date(dto.hireDate) : new Date(),
        salary: dto.salary ?? null,
        status: dto.status ?? 'ACTIVE',
        notes: dto.notes ?? null,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
    });
    await this.audit.log({
      action: 'EMPLOYEE_CREATE',
      entityType: 'Employee',
      entityId: created.id,
      after: {
        employeeNumber: created.employeeNumber,
        email: created.email,
        position: created.position,
        status: created.status,
      },
    });

    return this.sanitize(created);
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<PublicEmployee> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (dto.employeeNumber && dto.employeeNumber !== employee.employeeNumber) {
      const existing = await this.prisma.employee.findUnique({
        where: { tenantId_employeeNumber: { tenantId, employeeNumber: dto.employeeNumber } },
      });
      if (existing) throw new ConflictException('Employee number already exists');
    }

    if (dto.email && dto.email !== employee.email) {
      const existing = await this.prisma.employee.findUnique({
        where: { tenantId_email: { tenantId, email: dto.email } },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    // `null` desvincula la cuenta; omitir el campo deja el vínculo intacto.
    if (dto.userId !== undefined && dto.userId !== null && dto.userId !== employee.userId) {
      await this.assertLinkableAccount(tenantId, dto.userId);
    }

    const { birthDate, hireDate, ...rest } = dto;
    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
        ...(hireDate !== undefined ? { hireDate: new Date(hireDate) } : {}),
        updatedById: userId ?? null,
      },
    });

    if (dto.userId !== undefined && dto.userId !== employee.userId) {
      await this.audit.log({
        action: 'EMPLOYEE_UPDATE',
        entityType: 'Employee',
        entityId: id,
        before: { linkedUserId: employee.userId },
        after: { linkedUserId: dto.userId },
        reason: dto.userId ? 'Vinculación de cuenta' : 'Desvinculación de cuenta',
      });
    }
    await this.audit.log({
      action: 'EMPLOYEE_UPDATE',
      entityType: 'Employee',
      entityId: id,
      before: {
        employeeNumber: employee.employeeNumber,
        email: employee.email,
        position: employee.position,
        salary: employee.salary?.toString() ?? null,
        status: employee.status,
      },
      after: {
        employeeNumber: updated.employeeNumber,
        email: updated.email,
        position: updated.position,
        salary: updated.salary?.toString() ?? null,
        status: updated.status,
      },
    });

    return this.sanitize(updated);
  }

  async remove(id: string): Promise<PublicEmployee> {
    const tenantId = this.tenantContext.requireTenantId();
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const removed = await this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.INACTIVE },
    });
    await this.audit.log({
      action: 'EMPLOYEE_DEACTIVATE',
      entityType: 'Employee',
      entityId: id,
      before: { status: employee.status },
      after: { status: removed.status },
    });

    return this.sanitize(removed);
  }
}

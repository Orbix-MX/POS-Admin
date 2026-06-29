import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Employee, EmployeeStatus } from '@prisma/client';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/** Employee without the secret PIN hash; exposes only whether a PIN is set. */
export type PublicEmployee = Omit<Employee, 'pinHash'> & { hasPin: boolean };

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  /** Never leak the PIN hash to clients; surface a boolean instead. */
  private sanitize(e: Employee): PublicEmployee {
    const { pinHash, ...rest } = e;
    return { ...rest, hasPin: pinHash != null };
  }

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
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.sanitize(employee);
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

    const created = await this.prisma.employee.create({
      data: {
        tenantId,
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
    return this.sanitize(removed);
  }
}

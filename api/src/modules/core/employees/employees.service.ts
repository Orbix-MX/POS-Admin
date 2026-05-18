import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Employee, EmployeeStatus } from '@prisma/client';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<Employee>> {
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
      data: employees,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Employee> {
    const tenantId = this.tenantContext.requireTenantId();
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
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

    return this.prisma.employee.create({
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
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
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
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...rest,
        ...(birthDate !== undefined ? { birthDate: birthDate ? new Date(birthDate) : null } : {}),
        ...(hireDate !== undefined ? { hireDate: new Date(hireDate) } : {}),
        updatedById: userId ?? null,
      },
    });
  }

  async remove(id: string): Promise<Employee> {
    const tenantId = this.tenantContext.requireTenantId();
    const employee = await this.prisma.employee.findFirst({ where: { id, tenantId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.employee.update({
      where: { id },
      data: { status: EmployeeStatus.INACTIVE },
    });
  }
}

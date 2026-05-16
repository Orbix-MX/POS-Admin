import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Supplier, SupplierStatus } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<Supplier>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page } = paginationDto;
    const where = { tenantId };

    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data: suppliers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Supplier> {
    const tenantId = this.tenantContext.requireTenantId();
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const existing = await this.prisma.supplier.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    return this.prisma.supplier.create({
      data: {
        tenantId,
        name: dto.name,
        contactName: dto.contactName ?? null,
        email: dto.email,
        phone: dto.phone ?? null,
        city: dto.city ?? null,
        category: dto.category ?? null,
        paymentTerms: dto.paymentTerms ?? null,
        status: dto.status ?? 'ACTIVE',
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const tenantId = this.tenantContext.requireTenantId();
    const userId = this.auditContext.getUserId();

    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    if (dto.email && dto.email !== supplier.email) {
      const existing = await this.prisma.supplier.findUnique({
        where: { tenantId_email: { tenantId, email: dto.email } },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    return this.prisma.supplier.update({
      where: { id },
      data: { ...dto, updatedById: userId ?? null },
    });
  }

  async remove(id: string): Promise<Supplier> {
    const tenantId = this.tenantContext.requireTenantId();
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.prisma.supplier.update({
      where: { id },
      data: { status: SupplierStatus.INACTIVE },
    });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { AuditContextService } from '../../../common/context/audit-context.service';
import { PaginatedResponse } from '../../../common/dto/pagination.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { QueryServicesDto } from './dto/query-services.dto';
import { Service } from '@prisma/client';

@Injectable()
export class ServicesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
    private auditContext: AuditContextService,
  ) {}

  async create(dto: CreateServiceDto): Promise<Service> {
    const tenantId = this.tenantContext.requireTenantId();
    const createdById = this.auditContext.getUserId() ?? null;

    return this.prisma.service.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice,
        estimatedDuration: dto.estimatedDuration,
        hasVariablePrice: dto.hasVariablePrice ?? false,
        isActive: dto.isActive ?? true,
        ...(createdById && { createdById }),
      },
    });
  }

  async findAll(query: QueryServicesDto): Promise<PaginatedResponse<Service>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page, search, isActive } = query;

    const where: any = {
      tenantId,
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        name: { contains: search, mode: 'insensitive' },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.service.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string): Promise<Service> {
    const tenantId = this.tenantContext.requireTenantId();
    const service = await this.prisma.service.findFirst({ where: { id, tenantId } });
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const tenantId = this.tenantContext.requireTenantId();
    const updatedById = this.auditContext.getUserId() ?? null;

    const existing = await this.prisma.service.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Servicio no encontrado');

    return this.prisma.service.update({
      where: { id },
      data: {
        ...dto,
        ...(updatedById && { updatedById }),
      },
    });
  }
}

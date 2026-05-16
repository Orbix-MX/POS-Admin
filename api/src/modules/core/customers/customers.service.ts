import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { PaginationDto, PaginatedResponse } from '../../../common/dto/pagination.dto';
import { Customer, CustomerStatus, CustomerType } from '@prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResponse<Customer>> {
    const tenantId = this.tenantContext.requireTenantId();
    const { skip, limit, page } = paginationDto;

    const where = { tenantId };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { orders: true, addresses: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data: customers,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Customer> {
    const tenantId = this.tenantContext.requireTenantId();
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        addresses: true,
        orders: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.prisma.customer.findUnique({
      where: { tenantId_email: { tenantId, email: createCustomerDto.email } },
    });
    if (existing) throw new ConflictException('Email already registered');

    const hasCredit = createCustomerDto.hasCredit ?? false;
    const creditDays = hasCredit ? (createCustomerDto.creditDays ?? 0) : 0;
    const creditLimit = hasCredit ? (createCustomerDto.creditLimit ?? null) : null;

    if (hasCredit && creditDays < 1) {
      throw new BadRequestException('creditDays debe ser mayor a 0 cuando el crédito está habilitado');
    }

    return this.prisma.customer.create({
      data: {
        tenantId,
        email: createCustomerDto.email,
        firstName: createCustomerDto.firstName,
        lastName: createCustomerDto.lastName,
        phone: createCustomerDto.phone ?? null,
        company: createCustomerDto.company ?? null,
        city: createCustomerDto.city ?? null,
        status: createCustomerDto.status ?? CustomerStatus.ACTIVE,
        type: createCustomerDto.type ?? CustomerType.NEW,
        hasCredit,
        creditDays,
        creditLimit,
      },
    });
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto): Promise<Customer> {
    const tenantId = this.tenantContext.requireTenantId();

    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');

    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existing = await this.prisma.customer.findUnique({
        where: { tenantId_email: { tenantId, email: updateCustomerDto.email } },
      });
      if (existing) throw new ConflictException('Email already registered');
    }

    // Enforce credit rules when hasCredit is being updated
    const updateData: Omit<typeof updateCustomerDto, 'creditLimit'> & {
      creditDays?: number;
      creditLimit?: number | null;
    } = { ...updateCustomerDto };

    if (updateCustomerDto.hasCredit === true) {
      const creditDays = updateCustomerDto.creditDays ?? Number(customer.creditDays);
      if (creditDays < 1) {
        throw new BadRequestException('creditDays debe ser mayor a 0 cuando el crédito está habilitado');
      }
    }

    if (updateCustomerDto.hasCredit === false) {
      updateData.creditDays = 0;
      updateData.creditLimit = null;
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string): Promise<Customer> {
    const tenantId = this.tenantContext.requireTenantId();
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.customer.update({
      where: { id },
      data: { status: CustomerStatus.INACTIVE },
    });
  }
}

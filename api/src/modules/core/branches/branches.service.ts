import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BulkUpdateInventoryDto, TransferStockDto } from './dto/update-inventory.dto';
import { Branch, BranchInventory } from '@prisma/client';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private tenantContext: TenantContextService,
  ) {}

  async create(dto: CreateBranchDto): Promise<Branch> {
    const tenantId = this.tenantContext.requireTenantId();
    const exists = await this.prisma.branch.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (exists) throw new ConflictException('Branch code already exists in this tenant');

    // If isMain, unset any existing main branch
    if (dto.isMain) {
      await this.prisma.branch.updateMany({ where: { tenantId, isMain: true }, data: { isMain: false } });
    }

    return this.prisma.branch.create({
      data: { ...dto, tenantId },
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async findAll(): Promise<Branch[]> {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.branch.findMany({
      where: { tenantId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { memberships: true, orders: true, inventory: true } },
      },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string): Promise<Branch> {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({
      where: { id, tenantId },
      include: {
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        memberships: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } } },
        },
        _count: { select: { orders: true, inventory: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto): Promise<Branch> {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');

    if (dto.code && dto.code !== branch.code) {
      const conflict = await this.prisma.branch.findUnique({
        where: { tenantId_code: { tenantId, code: dto.code } },
      });
      if (conflict) throw new ConflictException('Branch code already exists');
    }

    if (dto.isMain) {
      await this.prisma.branch.updateMany({ where: { tenantId, isMain: true, NOT: { id } }, data: { isMain: false } });
    }

    return this.prisma.branch.update({
      where: { id },
      data: dto,
      include: { manager: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (branch.isMain) throw new BadRequestException('Cannot delete the main branch');
    await this.prisma.branch.delete({ where: { id } });
  }

  async setMain(id: string): Promise<Branch> {
    const tenantId = this.tenantContext.requireTenantId();
    await this.prisma.branch.updateMany({ where: { tenantId }, data: { isMain: false } });
    return this.prisma.branch.update({ where: { id }, data: { isMain: true } });
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async addMember(branchId: string, userId: string, isPrimary = false): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.branchMembership.upsert({
      where: { branchId_userId: { branchId, userId } },
      update: { isPrimary },
      create: { branchId, userId, isPrimary },
    });
  }

  async removeMember(branchId: string, userId: string): Promise<void> {
    await this.prisma.branchMembership.delete({
      where: { branchId_userId: { branchId, userId } },
    });
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  async getInventory(branchId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.branchInventory.findMany({
      where: { branchId },
      include: {
        product: { select: { id: true, name: true, sku: true, price: true, status: true, lowStockAlert: true } },
      },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async updateInventoryItem(branchId: string, productId: string, stock: number): Promise<BranchInventory> {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');

    return this.prisma.branchInventory.upsert({
      where: { branchId_productId: { branchId, productId } },
      update: { stock },
      create: { branchId, productId, stock },
    });
  }

  async bulkUpdateInventory(branchId: string, dto: BulkUpdateInventoryDto): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.branchInventory.upsert({
          where: { branchId_productId: { branchId, productId: item.productId } },
          update: { stock: item.stock },
          create: { branchId, productId: item.productId, stock: item.stock },
        }),
      ),
    );
  }

  async transferStock(fromBranchId: string, dto: TransferStockDto): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const [from, to] = await Promise.all([
      this.prisma.branch.findFirst({ where: { id: fromBranchId, tenantId } }),
      this.prisma.branch.findFirst({ where: { id: dto.toBranchId, tenantId } }),
    ]);
    if (!from || !to) throw new NotFoundException('Branch not found');

    const fromInv = await this.prisma.branchInventory.findUnique({
      where: { branchId_productId: { branchId: fromBranchId, productId: dto.productId } },
    });
    if (!fromInv || fromInv.stock < dto.quantity) {
      throw new BadRequestException('Insufficient stock in source branch');
    }

    await this.prisma.$transaction([
      this.prisma.branchInventory.update({
        where: { branchId_productId: { branchId: fromBranchId, productId: dto.productId } },
        data: { stock: { decrement: dto.quantity } },
      }),
      this.prisma.branchInventory.upsert({
        where: { branchId_productId: { branchId: dto.toBranchId, productId: dto.productId } },
        update: { stock: { increment: dto.quantity } },
        create: { branchId: dto.toBranchId, productId: dto.productId, stock: dto.quantity },
      }),
    ]);
  }
}

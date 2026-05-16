import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async findAll() {
    const tenantId = this.tenantContext.requireTenantId();
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { permissions: true, userAssignments: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { userAssignments: true } },
      },
    });

    if (!role) throw new NotFoundException(`Role with id "${id}" not found`);
    return role;
  }

  async create(dto: CreateRoleDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.prisma.role.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existing) throw new ConflictException(`Role with name "${dto.name}" already exists`);

    const role = await this.prisma.role.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        isSystem: false,
      },
    });

    if (dto.permissionIds && dto.permissionIds.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    return this.findOne(role.id);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException(`Role with id "${id}" not found`);

    if (role.isSystem && dto.name && dto.name !== role.name) {
      throw new BadRequestException('Cannot rename a system role');
    }

    if (dto.name && dto.name !== role.name) {
      const existing = await this.prisma.role.findUnique({
        where: { tenantId_name: { tenantId, name: dto.name } },
      });
      if (existing) throw new ConflictException(`Role with name "${dto.name}" already exists`);
    }

    const { permissionIds, ...roleData } = dto;
    await this.prisma.role.update({ where: { id }, data: roleData });

    if (permissionIds !== undefined) {
      await this.setPermissions(id, permissionIds);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({ where: { id, tenantId } });
    if (!role) throw new NotFoundException(`Role with id "${id}" not found`);
    if (role.isSystem) throw new BadRequestException('Cannot delete a system role');
    await this.prisma.role.delete({ where: { id } });
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<void> {
    const tenantId = this.tenantContext.requireTenantId();
    const role = await this.prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw new NotFoundException(`Role with id "${roleId}" not found`);

    if (role.isSystem && permissionIds.length === 0) {
      throw new BadRequestException('Cannot remove all permissions from a system role');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      ...(permissionIds.length > 0
        ? [
            this.prisma.rolePermission.createMany({
              data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ALL_PERMISSIONS, MODULES_ORDER } from './permissions.constants';

export interface PermissionGrouped {
  module: string;
  permissions: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    module: string;
    action: string;
  }[];
}

@Injectable()
export class PermissionsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedPermissions();
  }

  async seedPermissions(): Promise<void> {
    for (const perm of ALL_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { key: perm.key },
        update: {
          name: perm.name,
          description: perm.description ?? null,
          module: perm.module,
          action: perm.action,
        },
        create: {
          key: perm.key,
          name: perm.name,
          description: perm.description ?? null,
          module: perm.module,
          action: perm.action,
        },
      });
    }
  }

  async findAll(): Promise<PermissionGrouped[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    // Group by module in MODULES_ORDER order
    const grouped = new Map<string, PermissionGrouped>();

    for (const mod of MODULES_ORDER) {
      grouped.set(mod, { module: mod, permissions: [] });
    }

    for (const perm of permissions) {
      if (!grouped.has(perm.module)) {
        grouped.set(perm.module, { module: perm.module, permissions: [] });
      }
      grouped.get(perm.module)!.permissions.push(perm);
    }

    return Array.from(grouped.values()).filter((g) => g.permissions.length > 0);
  }

  async findFlat() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }
}

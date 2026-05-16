import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

interface CacheEntry {
  permissions: string[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds

@Injectable()
export class PermissionsGuard implements CanActivate {
  private cache = new Map<string, CacheEntry>();

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions required → allow
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // SUPER_ADMIN bypasses all permission checks
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // tenantId comes from the JWT (set by JwtStrategy)
    const tenantId: string | undefined = user.tenantId;
    if (!tenantId) {
      return false;
    }

    const effectivePermissions = await this.getEffectivePermissions(
      user.id,
      tenantId,
    );

    return requiredPermissions.every((perm) =>
      effectivePermissions.includes(perm),
    );
  }

  private async getEffectivePermissions(
    userId: string,
    tenantId: string,
  ): Promise<string[]> {
    const cacheKey = `${userId}:${tenantId}`;
    const now = Date.now();

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.permissions;
    }

    // Get all permissions from assigned roles (scoped to tenant)
    const roleAssignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissionKeys = new Set<string>();
    for (const assignment of roleAssignments) {
      for (const rp of assignment.role.permissions) {
        permissionKeys.add(rp.permission.key);
      }
    }

    // Get individual grants/revokes (scoped to tenant)
    const individualGrants = await this.prisma.userPermissionGrant.findMany({
      where: { userId, tenantId },
      include: { permission: true },
    });

    for (const grant of individualGrants) {
      if (grant.granted) {
        permissionKeys.add(grant.permission.key);
      } else {
        permissionKeys.delete(grant.permission.key);
      }
    }

    const permissions = Array.from(permissionKeys);

    // Store in cache
    this.cache.set(cacheKey, {
      permissions,
      expiresAt: now + CACHE_TTL_MS,
    });

    // Evict expired entries periodically (every 100 writes)
    if (this.cache.size > 100) {
      for (const [key, entry] of this.cache) {
        if (entry.expiresAt <= now) {
          this.cache.delete(key);
        }
      }
    }

    return permissions;
  }
}

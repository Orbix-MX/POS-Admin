import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { LicenseStatus, TenantPlan, TenantStatus, Prisma } from '@prisma/client';
import { getMaxBranchesForPlan } from '@orbix/types';
import { PrismaService } from '../../database/prisma.service';

export type LicenseInvalidReason =
  | 'NO_LICENSE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'NOT_STARTED';

export interface LicenseValidation {
  valid: boolean;
  reason?: LicenseInvalidReason;
  status?: LicenseStatus;
  expiresAt?: Date | null;
  licenseId?: string;
}

export interface CreateLicenseInput {
  plan: TenantPlan;
  status?: LicenseStatus; // defaults to ACTIVE (or TRIAL when trialDays given)
  startsAt?: Date;
  expiresAt?: Date | null; // null = perpetual
  trialDays?: number; // convenience: sets TRIAL + expiresAt
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxDevices?: number | null;
  licenseKey?: string; // optional pre-issued key
  notes?: string;
}

export interface RenewLicenseInput {
  expiresAt?: Date | null; // explicit new expiry
  extendDays?: number; // or extend from the later of now / current expiry
  plan?: TenantPlan; // optional plan change on renewal
  maxUsers?: number | null;
  maxBranches?: number | null;
  maxDevices?: number | null;
  notes?: string;
}

const NON_TERMINAL: LicenseStatus[] = ['TRIAL', 'ACTIVE', 'SUSPENDED'];

/**
 * Centralized licensing authority. The License is the source of truth; every
 * mutation syncs derived fields onto the Tenant (plan, status, user/branch
 * limits) so existing plan/limit/module logic keeps working unchanged.
 *
 * `validateLicense` checks the live date window and lazily flips an over-due
 * license to EXPIRED (no cron needed). Results are cached briefly for the
 * per-request LicenseGuard.
 */
@Injectable()
export class LicenseService {
  private readonly cache = new Map<string, { result: LicenseValidation; expiresAt: number }>();
  private static readonly CACHE_TTL_MS = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  // ─── Key generation ────────────────────────────────────────────────────────
  private rawKey(): string {
    const hex = randomBytes(8).toString('hex').toUpperCase(); // 16 chars
    return `ORBX-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
  }

  async generateLicenseKey(): Promise<string> {
    // Collisions are astronomically unlikely, but guarantee uniqueness anyway.
    for (let i = 0; i < 5; i++) {
      const key = this.rawKey();
      const exists = await this.prisma.license.findUnique({ where: { licenseKey: key }, select: { id: true } });
      if (!exists) return key;
    }
    throw new Error('Could not generate a unique license key');
  }

  // ─── Status mapping & tenant sync ───────────────────────────────────────────
  private toTenantStatus(status: LicenseStatus): TenantStatus {
    // LicenseStatus and TenantStatus share these names 1:1.
    return status;
  }

  /** Pushes the license's derived fields onto the Tenant so existing logic sees them. */
  private async syncTenant(
    tx: Prisma.TransactionClient,
    tenantId: string,
    license: { status: LicenseStatus; plan: TenantPlan; maxUsers: number | null; maxBranches: number | null },
  ): Promise<void> {
    // Map absolute maxBranches → additive extraBranchLimit on top of plan base.
    let extraBranchLimit: number | undefined;
    if (license.maxBranches != null) {
      const base = getMaxBranchesForPlan(license.plan, 0);
      extraBranchLimit = base == null ? 0 : Math.max(0, license.maxBranches - base);
    }

    await tx.tenant.update({
      where: { id: tenantId },
      data: {
        plan: license.plan,
        status: this.toTenantStatus(license.status),
        userLimitOverride: license.maxUsers ?? null,
        ...(extraBranchLimit !== undefined ? { extraBranchLimit } : {}),
      },
    });
  }

  private invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  // ─── Queries ────────────────────────────────────────────────────────────────
  /** The tenant's most-recent license (any status). */
  async getCurrentLicense(tenantId: string) {
    return this.prisma.license.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The tenant's active (non-terminal) license, or null. */
  async getActiveLicense(tenantId: string) {
    return this.prisma.license.findFirst({
      where: { tenantId, status: { in: NON_TERMINAL } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Masks a license key for tenant-facing display (reveals only the last group). */
  private maskKey(key: string): string {
    const parts = key.split('-');
    if (parts.length < 2) return '••••';
    const last = parts[parts.length - 1];
    return [parts[0], ...parts.slice(1, -1).map(() => '••••'), last].join('-');
  }

  /**
   * Tenant-facing license overview: never exposes the raw license key, includes
   * live validation and device-seat usage. Safe to show inside the tenant app.
   */
  async getLicenseOverview(tenantId: string) {
    const [license, validation, activeDevices] = await Promise.all([
      this.getCurrentLicense(tenantId),
      this.validateLicense(tenantId),
      this.prisma.device.count({ where: { tenantId, status: 'ACTIVE' } }),
    ]);

    return {
      license: license
        ? {
            keyMasked: this.maskKey(license.licenseKey),
            status: license.status,
            plan: license.plan,
            startsAt: license.startsAt,
            expiresAt: license.expiresAt,
            maxUsers: license.maxUsers,
            maxBranches: license.maxBranches,
            maxDevices: license.maxDevices,
          }
        : null,
      validation,
      devices: { active: activeDevices, max: license?.maxDevices ?? null },
    };
  }

  // ─── Validation ──────────────────────────────────────────────────────────────
  async validateLicense(tenantId: string): Promise<LicenseValidation> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const result = await this.computeValidation(tenantId);
    this.cache.set(tenantId, { result, expiresAt: Date.now() + LicenseService.CACHE_TTL_MS });
    return result;
  }

  private async computeValidation(tenantId: string): Promise<LicenseValidation> {
    const license = await this.getCurrentLicense(tenantId);
    if (!license) return { valid: false, reason: 'NO_LICENSE' };

    const base: LicenseValidation = { valid: false, status: license.status, expiresAt: license.expiresAt, licenseId: license.id };
    const now = Date.now();

    if (license.status === 'SUSPENDED') return { ...base, reason: 'SUSPENDED' };
    if (license.status === 'CANCELLED') return { ...base, reason: 'CANCELLED' };
    if (license.status === 'EXPIRED') return { ...base, reason: 'EXPIRED' };

    // TRIAL or ACTIVE — check the date window.
    if (license.startsAt.getTime() > now) return { ...base, reason: 'NOT_STARTED' };

    if (license.expiresAt && license.expiresAt.getTime() <= now) {
      // Lazily expire (+ sync tenant) so the rest of the system reflects it.
      await this.prisma.$transaction(async (tx) => {
        await tx.license.update({ where: { id: license.id }, data: { status: 'EXPIRED' } });
        await this.syncTenant(tx, tenantId, { ...license, status: 'EXPIRED' });
      });
      return { ...base, status: 'EXPIRED', reason: 'EXPIRED' };
    }

    return { valid: true, status: license.status, expiresAt: license.expiresAt, licenseId: license.id };
  }

  /** Throws a coded Forbidden-style error when the tenant has no valid license. */
  async assertValid(tenantId: string): Promise<void> {
    const v = await this.validateLicense(tenantId);
    if (!v.valid) {
      throw new BadRequestException({ code: `LICENSE_${v.reason}`, message: this.reasonMessage(v.reason) });
    }
  }

  reasonMessage(reason?: LicenseInvalidReason): string {
    switch (reason) {
      case 'EXPIRED':
        return 'La licencia de la empresa ha expirado. Renueva para continuar.';
      case 'SUSPENDED':
        return 'La licencia de la empresa está suspendida. Contacta al administrador.';
      case 'CANCELLED':
        return 'La licencia de la empresa fue cancelada.';
      case 'NOT_STARTED':
        return 'La licencia de la empresa aún no está vigente.';
      case 'NO_LICENSE':
      default:
        return 'La empresa no tiene una licencia vigente.';
    }
  }

  // ─── Mutations ────────────────────────────────────────────────────────────────
  async createLicense(tenantId: string, input: CreateLicenseInput, platformUserId?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const licenseKey = input.licenseKey ?? (await this.generateLicenseKey());
    const isTrial = !!input.trialDays;
    const status: LicenseStatus = input.status ?? (isTrial ? 'TRIAL' : 'ACTIVE');
    const startsAt = input.startsAt ?? new Date();
    const expiresAt =
      input.expiresAt !== undefined
        ? input.expiresAt
        : isTrial
          ? new Date(Date.now() + (input.trialDays as number) * 86_400_000)
          : null;

    const license = await this.prisma.$transaction(async (tx) => {
      // Supersede any existing non-terminal license — only one current at a time.
      await tx.license.updateMany({
        where: { tenantId, status: { in: NON_TERMINAL } },
        data: { status: 'CANCELLED' },
      });

      const created = await tx.license.create({
        data: {
          tenantId,
          licenseKey,
          status,
          plan: input.plan,
          startsAt,
          expiresAt,
          maxUsers: input.maxUsers ?? null,
          maxBranches: input.maxBranches ?? null,
          maxDevices: input.maxDevices ?? null,
          notes: input.notes,
        },
      });

      await this.syncTenant(tx, tenantId, created);
      return created;
    });

    await this.audit(platformUserId, tenantId, 'LICENSE_CREATED', license.id, {
      status,
      plan: input.plan,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    });
    this.invalidate(tenantId);
    return license;
  }

  async renewLicense(tenantId: string, input: RenewLicenseInput, platformUserId?: string) {
    const current = await this.getCurrentLicense(tenantId);
    if (!current) throw new NotFoundException('Tenant has no license to renew');

    let expiresAt: Date | null = current.expiresAt;
    if (input.expiresAt !== undefined) {
      expiresAt = input.expiresAt;
    } else if (input.extendDays) {
      const from = current.expiresAt && current.expiresAt.getTime() > Date.now() ? current.expiresAt : new Date();
      expiresAt = new Date(from.getTime() + input.extendDays * 86_400_000);
    }

    const plan = input.plan ?? current.plan;
    const maxUsers = input.maxUsers !== undefined ? input.maxUsers : current.maxUsers;
    const maxBranches = input.maxBranches !== undefined ? input.maxBranches : current.maxBranches;
    const maxDevices = input.maxDevices !== undefined ? input.maxDevices : current.maxDevices;

    const license = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.license.update({
        where: { id: current.id },
        data: { status: 'ACTIVE', expiresAt, plan, maxUsers, maxBranches, maxDevices, notes: input.notes ?? current.notes },
      });
      await this.syncTenant(tx, tenantId, updated);
      return updated;
    });

    await this.audit(platformUserId, tenantId, 'LICENSE_RENEWED', license.id, {
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      plan,
    });
    this.invalidate(tenantId);
    return license;
  }

  async suspendLicense(tenantId: string, reason?: string, platformUserId?: string) {
    const current = await this.getCurrentLicense(tenantId);
    if (!current) throw new NotFoundException('Tenant has no license');

    const license = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.license.update({ where: { id: current.id }, data: { status: 'SUSPENDED' } });
      await this.syncTenant(tx, tenantId, updated);
      return updated;
    });

    await this.audit(platformUserId, tenantId, 'LICENSE_SUSPENDED', license.id, { reason: reason ?? null });
    this.invalidate(tenantId);
    return license;
  }

  async activateLicense(tenantId: string, platformUserId?: string) {
    const current = await this.getCurrentLicense(tenantId);
    if (!current) throw new NotFoundException('Tenant has no license');

    if (current.expiresAt && current.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'LICENSE_EXPIRED',
        message: 'La licencia ya expiró. Renueva la licencia en lugar de activarla.',
      });
    }

    const license = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.license.update({ where: { id: current.id }, data: { status: 'ACTIVE' } });
      await this.syncTenant(tx, tenantId, updated);
      return updated;
    });

    await this.audit(platformUserId, tenantId, 'LICENSE_ACTIVATED', license.id, {});
    this.invalidate(tenantId);
    return license;
  }

  private async audit(
    platformUserId: string | undefined,
    tenantId: string,
    action: string,
    licenseId: string,
    after: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.platformAuditLog.create({
      data: {
        platformUserId,
        tenantId,
        action,
        entityType: 'License',
        entityId: licenseId,
        after: after as Prisma.InputJsonValue,
      },
    });
  }
}

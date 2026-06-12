import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LicenseService } from '../../../common/services/license.service';
import { ActivateDeviceDto } from './dto/activate-device.dto';

/**
 * Device registry for the active tenant. Activation is gated by the tenant's
 * license and capped by License.maxDevices. Works for any client kind
 * (WEB / POS_DESKTOP / MOBILE_COMANDERA / on-prem OTHER).
 */
@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly licenseService: LicenseService,
  ) {}

  async activate(tenantId: string, dto: ActivateDeviceDto) {
    // License must be valid to activate/seat a device.
    await this.licenseService.assertValid(tenantId);
    const license = await this.licenseService.getActiveLicense(tenantId);

    const existing = await this.prisma.device.findUnique({
      where: { tenantId_deviceId: { tenantId, deviceId: dto.deviceId } },
    });

    // Enforce the device seat limit only when seating a NEW active device.
    const willConsumeSeat = !existing || existing.status !== 'ACTIVE';
    if (willConsumeSeat && license?.maxDevices != null) {
      const activeCount = await this.prisma.device.count({ where: { tenantId, status: 'ACTIVE' } });
      if (activeCount >= license.maxDevices) {
        throw new BadRequestException({
          code: 'LICENSE_DEVICE_LIMIT',
          message: `La licencia permite máximo ${license.maxDevices} dispositivo(s) activo(s).`,
        });
      }
    }

    const now = new Date();
    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          type: dto.type ?? existing.type,
          status: 'ACTIVE',
          licenseId: license?.id ?? existing.licenseId,
          lastSeenAt: now,
        },
      });
    }

    return this.prisma.device.create({
      data: {
        tenantId,
        deviceId: dto.deviceId,
        name: dto.name,
        type: dto.type ?? 'OTHER',
        status: 'ACTIVE',
        licenseId: license?.id ?? null,
        lastSeenAt: now,
        activatedAt: now,
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.device.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { lastSeenAt: 'desc' }],
    });
  }

  async revoke(tenantId: string, id: string) {
    const device = await this.prisma.device.findFirst({ where: { id, tenantId } });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.device.update({ where: { id }, data: { status: 'REVOKED' } });
  }

  /** Lightweight liveness ping; also confirms the license is still valid. */
  async heartbeat(tenantId: string, deviceId: string) {
    await this.licenseService.assertValid(tenantId);
    const device = await this.prisma.device.findUnique({
      where: { tenantId_deviceId: { tenantId, deviceId } },
    });
    if (!device || device.status !== 'ACTIVE') {
      throw new NotFoundException('Device not active');
    }
    return this.prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });
  }
}

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateDomainDto } from './dto/domain.dto';

@Injectable()
export class PlatformDomainsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.domain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(tenantId: string, dto: CreateDomainDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const hostname = dto.hostname.toLowerCase();
    const existing = await this.prisma.domain.findUnique({ where: { hostname } });
    if (existing) throw new ConflictException('Este hostname ya está asignado a un tenant');

    // No hay verificación DNS (TXT record) automatizada todavía — quien crea el
    // dominio desde platform está confirmando manualmente que el DNS apunta
    // a este hosting. `verified` es lo que StoreDomainGuard exige para servir
    // datos, así que se marca true de una vez para no bloquear el flujo actual.
    return this.prisma.domain.create({
      data: { tenantId, hostname, verified: true },
    });
  }

  async remove(tenantId: string, domainId: string): Promise<void> {
    const domain = await this.prisma.domain.findFirst({ where: { id: domainId, tenantId } });
    if (!domain) throw new NotFoundException('Domain not found');
    await this.prisma.domain.delete({ where: { id: domainId } });
  }
}

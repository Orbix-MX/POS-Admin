import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto, AssignTemplateDto } from './dto/template.dto';
import { DEFAULT_SITE_SECTIONS } from '../../../common/constants/site-sections.constants';
import { SiteService } from '../../core/site/site.service';

@Injectable()
export class PlatformTemplatesService {
  constructor(
    private prisma: PrismaService,
    private siteService: SiteService,
  ) {}

  // ── Templates — solo registro de nombre/estado, sin componer secciones ─────

  async createTemplate(dto: CreateTemplateDto) {
    return this.prisma.template.create({ data: { name: dto.name } });
  }

  async listTemplates() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tenantSites: true } } },
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    await this.getTemplate(id);
    return this.prisma.template.update({
      where: { id },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.isActive !== undefined && { isActive: dto.isActive }) },
    });
  }

  // ── Asignación de plantilla a un tenant (su "tienda en línea") ─────────────
  // Sin soporte para cambiar de plantilla todavía: si el tenant ya tiene una
  // asignada, hay que quitarla (DELETE) antes de poder asignar otra.

  async assignToTenant(tenantId: string, dto: AssignTemplateDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const existing = await this.prisma.tenantSite.findUnique({ where: { tenantId } });
    if (existing) {
      throw new ConflictException('Este tenant ya tiene una plantilla asignada. Quítala antes de asignar otra.');
    }

    const template = await this.prisma.template.findUnique({ where: { id: dto.templateId } });
    if (!template) throw new NotFoundException('Template not found');
    if (!template.isActive) throw new BadRequestException('Esta plantilla está desactivada');

    return this.prisma.tenantSite.create({
      data: {
        tenantId,
        templateId: dto.templateId,
        siteSections: {
          create: DEFAULT_SITE_SECTIONS.map((s) => ({
            sectionType: s.sectionType,
            sortOrder: s.sortOrder,
            content: s.defaultContent as Prisma.InputJsonValue,
          })),
        },
      },
      include: { siteSections: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // Delega en SiteService, que además autocompleta cualquier sección que le
  // falte a un tenant asignado antes de que se agregara un tipo nuevo.
  getTenantSite(tenantId: string) {
    return this.siteService.getSite(tenantId);
  }

  async removeTenantSite(tenantId: string): Promise<void> {
    const site = await this.prisma.tenantSite.findUnique({ where: { tenantId } });
    if (!site) throw new NotFoundException('Este tenant no tiene una tienda en línea asignada');
    await this.prisma.tenantSite.delete({ where: { tenantId } });
  }
}

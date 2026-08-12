import { Injectable, NotFoundException } from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { R2Service } from '../../../storage/r2.service';
import { UpdateSiteSectionDto, ReorderSiteSectionsDto } from './dto/site.dto';
import { DEFAULT_SITE_SECTIONS } from '../../../common/constants/site-sections.constants';

const MAX_SITE_IMAGE_WIDTH = 1600;

/**
 * Todos los métodos toman `tenantId` explícito (no `TenantContextService`) para
 * que tanto el controller del propio tenant (tenantId = JWT) como el de
 * plataforma (tenantId = :tenantId de la URL) puedan reutilizar esta misma
 * lógica sin duplicarla.
 */
@Injectable()
export class SiteService {
  constructor(
    private prisma: PrismaService,
    private r2: R2Service,
  ) {}

  // Autocompleta secciones que falten (ej. tenants asignados antes de que se
  // agregara un tipo nuevo a DEFAULT_SITE_SECTIONS) en vez de dejarlos
  // atascados con el set con el que se les asignó la plantilla originalmente.
  async getSite(tenantId: string) {
    const site = await this.prisma.tenantSite.findUnique({
      where: { tenantId },
      include: { template: { select: { id: true, name: true } }, siteSections: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!site) throw new NotFoundException('Este tenant todavía no tiene una plantilla asignada');

    const existingTypes = new Set(site.siteSections.map((s) => s.sectionType));
    const missing = DEFAULT_SITE_SECTIONS.filter((d) => !existingTypes.has(d.sectionType));
    if (missing.length === 0) return site;

    const maxSortOrder = site.siteSections.reduce((max, s) => Math.max(max, s.sortOrder), -1);
    await this.prisma.tenantSiteSection.createMany({
      data: missing.map((d, i) => ({
        tenantId,
        sectionType: d.sectionType,
        sortOrder: maxSortOrder + 1 + i,
        content: d.defaultContent as Prisma.InputJsonValue,
      })),
    });

    return this.getSite(tenantId);
  }

  async updateSection(tenantId: string, sectionId: string, dto: UpdateSiteSectionDto) {
    const section = await this.prisma.tenantSiteSection.findFirst({ where: { id: sectionId, tenantId } });
    if (!section) throw new NotFoundException('Section not found');

    return this.prisma.tenantSiteSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.content !== undefined && { content: dto.content as Prisma.InputJsonValue }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async reorderSections(tenantId: string, dto: ReorderSiteSectionsDto) {
    const sections = await this.prisma.tenantSiteSection.findMany({ where: { tenantId }, select: { id: true } });
    const known = new Set(sections.map((s) => s.id));

    if (dto.order.length !== known.size || !dto.order.every((id) => known.has(id))) {
      throw new NotFoundException('El orden enviado no coincide con las secciones de este tenant');
    }

    // Dos pasadas para no chocar con @@unique([tenantId, sortOrder]) a medio
    // camino (ej. intercambiar 0↔1 pisaría el valor del otro a mitad de
    // transacción) — primero se mueven todas a un hueco negativo único,
    // luego a su posición final.
    await this.prisma.$transaction([
      ...dto.order.map((id, index) =>
        this.prisma.tenantSiteSection.update({ where: { id }, data: { sortOrder: -(index + 1) } }),
      ),
      ...dto.order.map((id, index) =>
        this.prisma.tenantSiteSection.update({ where: { id }, data: { sortOrder: index } }),
      ),
    ]);

    return this.getSite(tenantId);
  }

  async uploadImage(tenantId: string, file: Express.Multer.File): Promise<{ url: string }> {
    const webp = await sharp(file.buffer)
      .resize({ width: MAX_SITE_IMAGE_WIDTH, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const key = this.r2.buildSiteImageKey(tenantId, randomUUID());
    const url = await this.r2.upload(key, webp, 'image/webp');
    return { url };
  }
}

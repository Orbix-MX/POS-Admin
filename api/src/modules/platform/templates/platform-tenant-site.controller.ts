import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { PlatformTemplatesService } from './platform-templates.service';
import { AssignTemplateDto } from './dto/template.dto';
import { SiteService } from '../../core/site/site.service';
import { UpdateSiteSectionDto, ReorderSiteSectionsDto } from '../../core/site/dto/site.dto';

const MAX_SITE_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('Platform Tenant Site')
@ApiBearerAuth()
@Controller('platform/tenants/:tenantId/site')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformTenantSiteController {
  constructor(
    private readonly templatesService: PlatformTemplatesService,
    private readonly siteService: SiteService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get a tenant's assigned template + site sections" })
  get(@Param('tenantId') tenantId: string) {
    return this.templatesService.getTenantSite(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Assign a template to a tenant (clones its sections as the tenant own content)' })
  assign(@Param('tenantId') tenantId: string, @Body() dto: AssignTemplateDto) {
    return this.templatesService.assignToTenant(tenantId, dto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Unassign the tenant's template (removes its site + sections)" })
  remove(@Param('tenantId') tenantId: string) {
    return this.templatesService.removeTenantSite(tenantId);
  }

  // Edición del contenido en vivo del tenant, desde plataforma — mismo
  // SiteService que usa el tenant en /site/current, para no duplicar lógica.
  // 'reorder' debe declararse antes de ':id' (mismo motivo que en SiteController).
  @Patch('sections/reorder')
  @ApiOperation({ summary: "Reorder a tenant's site sections (as platform admin)" })
  reorderSections(@Param('tenantId') tenantId: string, @Body() dto: ReorderSiteSectionsDto) {
    return this.siteService.reorderSections(tenantId, dto);
  }

  @Patch('sections/:sectionId')
  @ApiOperation({ summary: "Update a tenant's site section content/visibility (as platform admin)" })
  updateSection(
    @Param('tenantId') tenantId: string,
    @Param('sectionId') sectionId: string,
    @Body() dto: UpdateSiteSectionDto,
  ) {
    return this.siteService.updateSection(tenantId, sectionId, dto);
  }

  @Post('images')
  @ApiOperation({ summary: "Upload an image for a tenant's site section (as platform admin)" })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadImage(
    @Param('tenantId') tenantId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_SITE_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.siteService.uploadImage(tenantId, file);
  }
}

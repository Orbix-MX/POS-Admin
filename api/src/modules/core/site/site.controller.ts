import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { SiteService } from './site.service';
import { UpdateSiteSectionDto, ReorderSiteSectionsDto } from './dto/site.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';
import { TenantContextService } from '../../../common/context/tenant-context.service';

const MAX_SITE_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

@RequireModule('tienda-online')
@ApiTags('Site')
@ApiBearerAuth()
@Controller('site')
export class SiteController {
  constructor(
    private readonly siteService: SiteService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get('current')
  @RequirePermissions('site:view')
  @ApiOperation({ summary: "Get the current tenant's assigned template + site sections" })
  getMySite() {
    return this.siteService.getSite(this.tenantContext.requireTenantId());
  }

  // 'reorder' debe declararse antes de ':id' — si no, Nest lo enruta como
  // updateSection(id: "reorder") por ser el primer match registrado.
  @Patch('current/sections/reorder')
  @RequirePermissions('site:edit')
  @ApiOperation({ summary: 'Reorder all site sections' })
  reorderSections(@Body() dto: ReorderSiteSectionsDto) {
    return this.siteService.reorderSections(this.tenantContext.requireTenantId(), dto);
  }

  @Patch('current/sections/:id')
  @RequirePermissions('site:edit')
  @ApiOperation({ summary: 'Update a site section (content and/or active state)' })
  updateSection(@Param('id') id: string, @Body() dto: UpdateSiteSectionDto) {
    return this.siteService.updateSection(this.tenantContext.requireTenantId(), id, dto);
  }

  @Post('current/images')
  @RequirePermissions('site:edit')
  @ApiOperation({ summary: 'Upload an image for use in a site section (returns its URL)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadImage(
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
    return this.siteService.uploadImage(this.tenantContext.requireTenantId(), file);
  }
}

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { TenantInfo } from './tenants.service';

const MAX_BRANDING_SIZE = 5 * 1024 * 1024;

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ── Super-admin endpoints ──────────────────────────────────────────────────

  @Post()
  @RequirePermissions('tenants:manage')
  @ApiOperation({ summary: 'Create a new tenant (super-admin only)' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @RequirePermissions('tenants:manage')
  @ApiOperation({ summary: 'List all tenants (super-admin only)' })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @RequirePermissions('tenants:manage')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('tenants:manage')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('tenants:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  // ── Current-tenant info & branding ────────────────────────────────────────

  @Get('current/info')
  @RequirePermissions('tenant:view')
  @ApiOperation({ summary: 'Get current tenant info and branding' })
  getInfo() {
    return this.tenantsService.getInfo();
  }

  @Patch('current/info')
  @RequirePermissions('tenant:edit')
  @ApiOperation({ summary: 'Update current tenant info (name, contact, etc.)' })
  updateInfo(@Body() dto: Partial<TenantInfo>) {
    return this.tenantsService.updateInfo(dto);
  }

  @Post('current/logo')
  @RequirePermissions('tenant:branding')
  @ApiOperation({ summary: 'Upload tenant logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadLogo(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_BRANDING_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.tenantsService.uploadLogo(file);
  }

  @Post('current/banner')
  @RequirePermissions('tenant:branding')
  @ApiOperation({ summary: 'Upload tenant banner' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadBanner(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_BRANDING_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.tenantsService.uploadBanner(file);
  }

  @Delete('current/logo')
  @RequirePermissions('tenant:branding')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant logo' })
  deleteLogo() {
    return this.tenantsService.deleteLogo();
  }

  @Delete('current/banner')
  @RequirePermissions('tenant:branding')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tenant banner' })
  deleteBanner() {
    return this.tenantsService.deleteBanner();
  }

  // ── Current-tenant settings ────────────────────────────────────────────────

  @Get('current/settings')
  @RequirePermissions('settings:view')
  @ApiOperation({ summary: 'Get settings for the current tenant' })
  getMySettings() {
    return this.tenantsService.getSettings();
  }

  @Patch('current/settings')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Merge-patch settings for the current tenant' })
  updateMySettings(@Body() patch: Record<string, unknown>) {
    return this.tenantsService.updateSettings(patch);
  }

  // ── Current-tenant member management ──────────────────────────────────────

  @Get('current/members')
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'List members of the current tenant' })
  listMembers() {
    return this.tenantsService.listMembers();
  }

  @Post('current/members/:userId')
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Add a user to the current tenant' })
  addMember(@Param('userId') userId: string, @Body('role') role?: string) {
    return this.tenantsService.addMember(userId, role as any);
  }

  @Delete('current/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users:delete')
  @ApiOperation({ summary: 'Remove a user from the current tenant' })
  removeMember(@Param('userId') userId: string) {
    return this.tenantsService.removeMember(userId);
  }
}

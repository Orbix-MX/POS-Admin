import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { PlatformDomainsService } from './platform-domains.service';
import { CreateDomainDto } from './dto/domain.dto';

@ApiTags('Platform Domains')
@ApiBearerAuth()
@Controller('platform/tenants/:tenantId/domains')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformDomainsController {
  constructor(private readonly domainsService: PlatformDomainsService) {}

  @Get()
  @ApiOperation({ summary: 'List domains mapped to this tenant' })
  list(@Param('tenantId') tenantId: string) {
    return this.domainsService.list(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Map a hostname to this tenant (e.g. its e-commerce custom domain)' })
  create(@Param('tenantId') tenantId: string, @Body() dto: CreateDomainDto) {
    return this.domainsService.create(tenantId, dto);
  }

  @Delete(':domainId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unmap a hostname from this tenant' })
  remove(@Param('tenantId') tenantId: string, @Param('domainId') domainId: string) {
    return this.domainsService.remove(tenantId, domainId);
  }
}

import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { PlatformTemplatesService } from './platform-templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@ApiTags('Platform Templates')
@ApiBearerAuth()
@Controller('platform/templates')
@Public()
@UseGuards(PlatformJwtAuthGuard)
export class PlatformTemplatesController {
  constructor(private readonly templatesService: PlatformTemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a template (its HTML/sections are fixed in code — this is just the assignable name/state)' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.createTemplate(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all templates' })
  list() {
    return this.templatesService.listTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a template' })
  get(@Param('id') id: string) {
    return this.templatesService.getTemplate(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or activate/deactivate a template' })
  update(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.updateTemplate(id, dto);
  }
}

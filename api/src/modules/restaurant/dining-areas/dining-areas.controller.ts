import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DiningAreasService } from './dining-areas.service';
import { CreateDiningAreaDto, UpdateDiningAreaDto } from './dto/dining-area.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@ApiTags('Dining Areas')
@ApiBearerAuth()
@RequireModule('dining-areas')
@Controller('branches/:branchId/dining-areas')
export class DiningAreasController {
  constructor(private readonly service: DiningAreasService) {}

  @Get()
  @RequirePermissions('restaurant.areas:view')
  @ApiOperation({ summary: 'List dining areas for a branch' })
  findAll(@Param('branchId', ParseUUIDPipe) branchId: string) {
    return this.service.findAll(branchId);
  }

  @Post()
  @RequirePermissions('restaurant.areas:create')
  @ApiOperation({ summary: 'Create a dining area' })
  create(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateDiningAreaDto,
  ) {
    return this.service.create(branchId, dto);
  }

  @Patch(':id')
  @RequirePermissions('restaurant.areas:update')
  @ApiOperation({ summary: 'Update a dining area (name, description, order, active)' })
  update(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiningAreaDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}

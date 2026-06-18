import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateRestaurantTableDto, UpdateRestaurantTableDto } from './dto/restaurant-table.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@ApiTags('Restaurant Tables')
@ApiBearerAuth()
@RequireModule('comanda')
@Controller('branches/:branchId/tables')
export class TablesController {
  constructor(private readonly service: TablesService) {}

  @Get()
  @RequirePermissions('restaurant.tables:view')
  @ApiOperation({ summary: 'List tables for a branch (optionally filter by area)' })
  @ApiQuery({ name: 'areaId', required: false })
  findAll(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query('areaId') areaId?: string,
  ) {
    if (areaId) return this.service.findByArea(branchId, areaId);
    return this.service.findAll(branchId);
  }

  @Post()
  @RequirePermissions('restaurant.tables:create')
  @ApiOperation({ summary: 'Create a restaurant table' })
  create(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Body() dto: CreateRestaurantTableDto,
  ) {
    return this.service.create(branchId, dto);
  }

  @Patch(':id')
  @RequirePermissions('restaurant.tables:update')
  @ApiOperation({ summary: 'Update a table (name, area, capacity, order, status, active)' })
  update(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRestaurantTableDto,
  ) {
    return this.service.update(branchId, id, dto);
  }
}

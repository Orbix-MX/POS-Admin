import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliesService } from './supplies.service';
import { CreateSupplyDto } from './dto/create-supply.dto';
import { UpdateSupplyDto } from './dto/update-supply.dto';
import { QuerySupplyDto } from './dto/query-supply.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@RequireModule('inventario')
@ApiTags('Supplies')
@Controller('supplies')
export class SuppliesController {
  constructor(private readonly suppliesService: SuppliesService) {}

  @Post()
  @ApiBearerAuth()
  @RequirePermissions('products:create')
  @ApiOperation({ summary: 'Create supply/ingredient' })
  create(@Body() dto: CreateSupplyDto) {
    return this.suppliesService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'List supplies with pagination' })
  findAll(@Query() queryDto: QuerySupplyDto) {
    return this.suppliesService.findAll(queryDto);
  }

  @Get('low-stock')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get supplies at or below min stock' })
  getLowStock() {
    return this.suppliesService.getLowStock();
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get supply by ID' })
  findOne(@Param('id') id: string) {
    return this.suppliesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Update supply' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplyDto) {
    return this.suppliesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:delete')
  @ApiOperation({ summary: 'Delete supply' })
  remove(@Param('id') id: string) {
    return this.suppliesService.remove(id);
  }

  @Patch(':id/stock')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Adjust supply stock (positive or negative)' })
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.suppliesService.adjustStock(id, dto);
  }

  @Get(':id/movements')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get supply movement history' })
  getMovements(@Param('id') id: string) {
    return this.suppliesService.getMovements(id);
  }
}

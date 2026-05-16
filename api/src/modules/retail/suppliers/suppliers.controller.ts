import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@RequireModule('proveedores')
@ApiTags('Suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @RequirePermissions('suppliers:view')
  @ApiOperation({ summary: 'Get all suppliers' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.suppliersService.findAll(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('suppliers:view')
  @ApiOperation({ summary: 'Get supplier by ID' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @RequirePermissions('suppliers:create')
  @ApiOperation({ summary: 'Create a new supplier' })
  create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Patch(':id')
  @RequirePermissions('suppliers:edit')
  @ApiOperation({ summary: 'Update a supplier' })
  update(@Param('id') id: string, @Body() updateSupplierDto: UpdateSupplierDto) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(':id')
  @RequirePermissions('suppliers:delete')
  @ApiOperation({ summary: 'Delete a supplier' })
  remove(@Param('id') id: string) {
    return this.suppliersService.remove(id);
  }
}

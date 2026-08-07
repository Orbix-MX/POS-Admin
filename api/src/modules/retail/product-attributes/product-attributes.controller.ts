import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductAttributesService } from './product-attributes.service';
import { CreateProductAttributeDto } from './dto/create-product-attribute.dto';
import { UpdateProductAttributeDto } from './dto/update-product-attribute.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

// Tenant-defined catalog of attribute types (Talla, Color, Tipo, ...) used to
// capture size/color/etc. on products flagged `isEcommerce`. Reuses the
// products:* permissions — this is a sub-resource of product management, not
// a standalone module.
@RequireModule('inventario')
@ApiTags('Product Attributes')
@Controller('product-attributes')
export class ProductAttributesController {
  constructor(private readonly productAttributesService: ProductAttributesService) {}

  @Post()
  @ApiBearerAuth()
  @RequirePermissions('products:create')
  @ApiOperation({ summary: 'Create a new product attribute type' })
  create(@Body() dto: CreateProductAttributeDto) {
    return this.productAttributesService.create(dto);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'List product attribute types' })
  findAll() {
    return this.productAttributesService.findAll();
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get a product attribute type by id' })
  findOne(@Param('id') id: string) {
    return this.productAttributesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Update a product attribute type' })
  update(@Param('id') id: string, @Body() dto: UpdateProductAttributeDto) {
    return this.productAttributesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:delete')
  @ApiOperation({ summary: 'Delete a product attribute type' })
  remove(@Param('id') id: string) {
    return this.productAttributesService.remove(id);
  }
}

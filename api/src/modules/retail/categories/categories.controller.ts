import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService, CategoryWithChildren } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@RequireModule('inventario')
@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiBearerAuth()
  @RequirePermissions('categories:create')
  @ApiOperation({ summary: 'Create a new category' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('categories:view')
  @ApiOperation({ summary: 'Get all categories' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('tree')
  @Public()
  @ApiOperation({ summary: 'Get category tree (hierarchical)' })
  findTree(): Promise<CategoryWithChildren[]> {
    return this.categoriesService.findTree();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get category by ID' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions('categories:edit')
  @ApiOperation({ summary: 'Update category' })
  update(@Param('id') id: string, @Body() updateCategoryDto: UpdateCategoryDto) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions('categories:delete')
  @ApiOperation({ summary: 'Delete category' })
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}

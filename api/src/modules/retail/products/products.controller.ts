import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Res,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiQuery } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { ProductsImportService, type ImportFormat } from './products-import.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { ResolveCodeDto } from './dto/resolve-code.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';
import { RecipeItemDto, ComboItemDto } from './dto/create-product.dto';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB
/**
 * Lo que se acepta subir.
 *
 * `octet-stream` está porque es lo que mandan varios navegadores y el picker de
 * Android cuando no reconocen la extensión, y `vnd.ms-excel` porque Windows
 * marca así los `.csv` cuando Excel está instalado — de ahí que el formato real
 * NO se decida por el MIME, sino por la extensión del nombre original.
 */
const IMPORT_MIME =
  /^(application\/(vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel|octet-stream)|text\/(csv|plain|comma-separated-values))$/;

/**
 * El formato del archivo subido, por su extensión.
 *
 * El MIME no sirve para decidirlo: Windows anuncia los `.csv` como
 * `application/vnd.ms-excel` si Excel está instalado, y el picker de Android
 * manda `application/octet-stream` para los dos. La extensión es lo único que
 * el usuario controla y que dice la verdad; si no hay ninguna reconocible se
 * asume `.xlsx`, que es lo que descarga la plantilla por defecto.
 */
function importFormatOf(file: Express.Multer.File): ImportFormat {
  return /\.csv$/i.test(file.originalname ?? '') ? 'csv' : 'xlsx';
}

@RequireModule('inventario')
@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productsImportService: ProductsImportService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @RequirePermissions('products:create')
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get all products with pagination and filters' })
  findAll(@Query() queryDto: QueryProductDto) {
    return this.productsService.findAll(queryDto);
  }

  @Get('low-stock')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get products with low stock' })
  getLowStock() {
    return this.productsService.getLowStock();
  }

  @Get('import/template')
  @ApiBearerAuth()
  @RequirePermissions('products:create|products:edit')
  @ApiOperation({ summary: 'Download the template for bulk product import (.xlsx or .csv)' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'csv'], required: false })
  async downloadImportTemplate(@Res() res: Response, @Query('format') format?: string) {
    const csv = format === 'csv';
    const buffer = await this.productsImportService.buildTemplate(csv ? 'csv' : 'xlsx');
    res.set({
      'Content-Type': csv
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla-productos.${csv ? 'csv' : 'xlsx'}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('import')
  @ApiBearerAuth()
  @RequirePermissions('products:create|products:edit')
  @ApiOperation({ summary: 'Bulk create/update products from a filled .xlsx template' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMPORT_SIZE }),
          // `fallbackToMimetype` no es opcional aquí: Nest 11 valida el tipo por
          // los magic numbers del contenido, y un CSV es texto plano — no tiene
          // firma que detectar, así que sin esto TODO CSV se rechaza con un 400
          // que además dice «current file type is text/csv», como si el tipo
          // estuviera mal. El `.xlsx` sigue validándose por su firma real (es un
          // zip); solo el texto cae al mimetype declarado.
          new FileTypeValidator({ fileType: IMPORT_MIME, fallbackToMimetype: true }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.productsImportService.importFile(file.buffer, importFormatOf(file));
  }

  @Get('resolve')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Resolve a scanned barcode or SKU to a product and its variant' })
  resolve(@Query() dto: ResolveCodeDto) {
    return this.productsService.resolveByCode(dto.code);
  }

  @Get(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get product by ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Update product' })
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @RequirePermissions('products:delete')
  @ApiOperation({ summary: 'Delete product' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post(':id/image')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Upload product image (replaces existing primary image)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  uploadImage(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.productsService.uploadImage(id, file);
  }

  @Delete(':id/images/:imageId')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Remove product image' })
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.productsService.removeImage(id, imageId);
  }

  @Patch(':id/stock')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({
    summary: 'Update product stock (SIMPLE only)',
    description:
      'Ajusta la variante default — "el producto en sí". Para una presentación ' +
      'concreta, usar `PATCH /products/:id/variants/:variantId/stock`.',
  })
  updateStock(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.productsService.updateStock(id, quantity);
  }

  @Patch(':id/variants/:variantId/stock')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({
    summary: 'Adjust the stock of one variant in the current branch',
    description:
      'Aplica un delta (positivo o negativo) sobre la existencia de esa variante ' +
      'en la sucursal del token, y deja su InventoryMovement de tipo AJUSTE. Es la ' +
      'única forma de mover la existencia de una variante con nombre tras crearla.',
  })
  updateVariantStock(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.productsService.updateVariantStock(id, variantId, quantity);
  }

  @Get(':id/recipe')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get recipe for a RECIPE-type product' })
  getRecipe(@Param('id') id: string) {
    return this.productsService.getRecipe(id);
  }

  @Put(':id/recipe')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Upsert recipe items for a RECIPE-type product' })
  upsertRecipe(
    @Param('id') id: string,
    @Body('items') items: RecipeItemDto[],
    @Body('notes') notes?: string,
  ) {
    return this.productsService.upsertRecipe(id, items, notes);
  }

  @Get(':id/combo-items')
  @ApiBearerAuth()
  @RequirePermissions('products:view')
  @ApiOperation({ summary: 'Get combo items for a COMBO-type product' })
  getComboItems(@Param('id') id: string) {
    return this.productsService.getComboItems(id);
  }

  @Put(':id/combo-items')
  @ApiBearerAuth()
  @RequirePermissions('products:edit')
  @ApiOperation({ summary: 'Upsert combo items for a COMBO-type product' })
  upsertComboItems(
    @Param('id') id: string,
    @Body('items') items: ComboItemDto[],
  ) {
    return this.productsService.upsertComboItems(id, items.map((i) => ({
      childProductId: i.childProductId,
      quantity: i.quantity ?? 1,
    })));
  }
}

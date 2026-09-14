import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { CustomersService } from './customers.service';
import { CustomersImportService, type ImportFormat } from './customers-import.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB

/** Mismo criterio que en productos: ver `products.controller.ts`. */
const IMPORT_MIME =
  /^(application\/(vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|vnd\.ms-excel|octet-stream)|text\/(csv|plain|comma-separated-values))$/;

/** El formato lo decide la extensión, no el MIME, que no es de fiar. */
function importFormatOf(file: Express.Multer.File): ImportFormat {
  return /\.csv$/i.test(file.originalname ?? '') ? 'csv' : 'xlsx';
}

@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly customersImportService: CustomersImportService,
  ) {}

  @Get('import/template')
  @RequirePermissions('customers:create|customers:edit')
  @ApiOperation({ summary: 'Download the template for bulk customer import (.xlsx or .csv)' })
  @ApiQuery({ name: 'format', enum: ['xlsx', 'csv'], required: false })
  async downloadImportTemplate(@Res() res: Response, @Query('format') format?: string) {
    const csv = format === 'csv';
    const buffer = await this.customersImportService.buildTemplate(csv ? 'csv' : 'xlsx');
    res.set({
      'Content-Type': csv
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="plantilla-clientes.${csv ? 'csv' : 'xlsx'}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('import')
  @RequirePermissions('customers:create|customers:edit')
  @ApiOperation({ summary: 'Bulk create/update customers from a filled template' })
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
    return this.customersImportService.importFile(file.buffer, importFormatOf(file));
  }

  @Get()
  @RequirePermissions('customers:view')
  @ApiOperation({ summary: 'Get all customers' })
  findAll(@Query() paginationDto: PaginationDto) {
    return this.customersService.findAll(paginationDto);
  }

  @Get(':id')
  @RequirePermissions('customers:view')
  @ApiOperation({ summary: 'Get customer by ID' })
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @RequirePermissions('customers:create')
  @ApiOperation({ summary: 'Create a new customer' })
  create(@Body() createCustomerDto: CreateCustomerDto) {
    return this.customersService.create(createCustomerDto);
  }

  @Patch(':id')
  @RequirePermissions('customers:edit')
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @RequirePermissions('customers:delete')
  @ApiOperation({ summary: 'Delete a customer' })
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}

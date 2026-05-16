import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ServiceQuotesService } from './service-quotes.service';
import { QuotePdfService } from './quote-pdf.service';
import { CreateServiceQuoteDto } from './dto/create-service-quote.dto';
import { UpdateServiceQuoteDto } from './dto/update-service-quote.dto';
import { QueryServiceQuotesDto } from './dto/query-service-quotes.dto';
import { ConvertQuoteDto } from './dto/convert-quote.dto';
import { RequireModule } from '../../../common/guards/require-module.guard';

@RequireModule('cotizaciones')
@ApiTags('Service Quotes')
@ApiBearerAuth()
@Controller('service-quotes')
export class ServiceQuotesController {
  constructor(
    private readonly serviceQuotesService: ServiceQuotesService,
    private readonly quotePdfService: QuotePdfService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear cotización de servicios' })
  create(@Body() dto: CreateServiceQuoteDto) {
    return this.serviceQuotesService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryServiceQuotesDto) {
    return this.serviceQuotesService.findAll(query);
  }

  @Get('customer/:customerId')
  @ApiOperation({ summary: 'Cotizaciones activas de un cliente (para POS)' })
  findByCustomer(@Param('customerId', ParseUUIDPipe) customerId: string) {
    return this.serviceQuotesService.findByCustomer(customerId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceQuotesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceQuoteDto) {
    return this.serviceQuotesService.update(id, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Aprobar cotización' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceQuotesService.approve(id);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convertir cotización aprobada a venta' })
  convert(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConvertQuoteDto) {
    return this.serviceQuotesService.convert(id, dto);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Descargar PDF de cotización' })
  async getPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.quotePdfService.generate(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}

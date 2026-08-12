import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrinterConfigsService } from './printer-configs.service';
import { QzSigningService } from './qz-signing.service';
import {
  CreatePrinterConfigDto, PrintReceiptDto, PrintCashSessionReceiptDto, QzSignDto, UpdatePrinterConfigDto,
} from './dto/printer-config.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Printer Configs')
@ApiBearerAuth()
@Controller('printer-configs')
export class PrinterConfigsController {
  constructor(
    private readonly printerConfigsService: PrinterConfigsService,
    private readonly qzSigning: QzSigningService,
  ) {}

  @Get()
  @RequirePermissions('settings:view')
  @ApiOperation({ summary: 'List printer configs for the current tenant' })
  findAll() {
    return this.printerConfigsService.findAll();
  }

  @Post()
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Create a printer config' })
  create(@Body() dto: CreatePrinterConfigDto) {
    return this.printerConfigsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('settings:manage')
  @ApiOperation({ summary: 'Update a printer config' })
  update(@Param('id') id: string, @Body() dto: UpdatePrinterConfigDto) {
    return this.printerConfigsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('settings:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a printer config' })
  remove(@Param('id') id: string) {
    return this.printerConfigsService.remove(id);
  }

  @Post('print-receipt')
  @RequirePermissions('settings:view|orders:create|comanda:view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Imprime recibo de venta en la impresora SALE_TICKET configurada' })
  printReceipt(@Body() body: PrintReceiptDto) {
    return this.printerConfigsService.printReceipt(body.orderId, body.printerType);
  }

  @Post('receipt-data')
  @RequirePermissions('settings:view|orders:create|comanda:view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Obtiene bytes ESC/POS para imprimir en cliente via QZ Tray' })
  getReceiptData(@Body() body: PrintReceiptDto) {
    return this.printerConfigsService.getReceiptData(body.orderId, body.printerType);
  }

  @Post('cash-session-receipt-data')
  @RequirePermissions('pos.cash:count')
  @HttpCode(200)
  @ApiOperation({ summary: 'Obtiene bytes ESC/POS del ticket de arqueo para imprimir en cliente via QZ Tray' })
  getCashSessionReceiptData(@Body() body: PrintCashSessionReceiptDto) {
    return this.printerConfigsService.getCashSessionReceiptData(body.cashSessionId, body.printerType);
  }

  @Post('print-cash-session-receipt')
  @RequirePermissions('pos.cash:count')
  @HttpCode(200)
  @ApiOperation({ summary: 'Imprime ticket de arqueo de caja en la impresora TICKET configurada' })
  printCashSessionReceipt(@Body() body: PrintCashSessionReceiptDto) {
    return this.printerConfigsService.printCashSessionReceipt(body.cashSessionId, body.printerType);
  }

  @Get('qz/certificate')
  @RequirePermissions('settings:view|orders:create|comanda:view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Certificado público para firmar peticiones de QZ Tray' })
  qzCertificate() {
    return {
      certificate: this.qzSigning.getCertificate(),
      configured: this.qzSigning.isConfigured(),
    };
  }

  @Post('qz/sign')
  @RequirePermissions('settings:view|orders:create|comanda:view')
  @HttpCode(200)
  @ApiOperation({ summary: 'Firma una petición de QZ Tray con la llave privada (RSA-SHA512)' })
  qzSign(@Body() body: QzSignDto) {
    return { signature: this.qzSigning.sign(body.request) };
  }
}

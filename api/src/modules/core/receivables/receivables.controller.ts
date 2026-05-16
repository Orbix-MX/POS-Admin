import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReceivablesService } from './receivables.service';
import { QueryReceivablesDto } from './dto/query-receivables.dto';
import { RegisterCxCPaymentDto } from './dto/register-payment.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';

@RequireModule('cxc')
@ApiTags('Receivables')
@ApiBearerAuth()
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly receivablesService: ReceivablesService) {}

  @Get()
  @RequirePermissions('receivables:view')
  @ApiOperation({ summary: 'Listar cuentas por cobrar' })
  findAll(@Query() query: QueryReceivablesDto) {
    return this.receivablesService.findAll(query);
  }

  @Get('stats')
  @RequirePermissions('receivables:view')
  @ApiOperation({ summary: 'Estadísticas de CxC' })
  getStats() {
    return this.receivablesService.getStats();
  }

  @Get(':id')
  @RequirePermissions('receivables:view')
  @ApiOperation({ summary: 'Detalle de cuenta por cobrar' })
  findOne(@Param('id') id: string) {
    return this.receivablesService.findOne(id);
  }

  @Post(':id/payments')
  @RequirePermissions('receivables:pay')
  @ApiOperation({ summary: 'Registrar pago a cuenta por cobrar' })
  registerPayment(@Param('id') id: string, @Body() dto: RegisterCxCPaymentDto) {
    return this.receivablesService.registerPayment(id, dto);
  }
}

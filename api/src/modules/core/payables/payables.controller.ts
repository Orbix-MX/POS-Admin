import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayablesService } from './payables.service';
import { QueryPayablesDto } from './dto/query-payables.dto';
import { RegisterPayablePaymentDto } from './dto/register-payment.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Payables')
@ApiBearerAuth()
@Controller('payables')
export class PayablesController {
  constructor(private readonly payablesService: PayablesService) {}

  @Get()
  @RequirePermissions('payables:view')
  @ApiOperation({ summary: 'Listar cuentas por pagar' })
  findAll(@Query() query: QueryPayablesDto) {
    return this.payablesService.findAll(query);
  }

  @Get('stats')
  @RequirePermissions('payables:view')
  @ApiOperation({ summary: 'Estadísticas de CxP' })
  getStats() {
    return this.payablesService.getStats();
  }

  @Get(':id')
  @RequirePermissions('payables:view')
  @ApiOperation({ summary: 'Detalle de cuenta por pagar' })
  findOne(@Param('id') id: string) {
    return this.payablesService.findOne(id);
  }

  @Post(':id/payments')
  @RequirePermissions('payables:pay')
  @ApiOperation({ summary: 'Registrar pago a proveedor' })
  registerPayment(@Param('id') id: string, @Body() dto: RegisterPayablePaymentDto) {
    return this.payablesService.registerPayment(id, dto);
  }
}

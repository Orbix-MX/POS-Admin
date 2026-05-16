import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CashSessionsService } from './cash-sessions.service';
import { OpenCashSessionDto } from './dto/open-session.dto';
import { CloseCashSessionDto } from './dto/close-session.dto';
import { QueryCashSessionsDto } from './dto/query-sessions.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';

@ApiTags('Cash Sessions')
@ApiBearerAuth()
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Get('active')
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Sesión activa actual' })
  getActive(@Query('branchId') branchId?: string) {
    return this.cashSessionsService.getActive(branchId);
  }

  @Get()
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Historial de sesiones de caja' })
  findAll(@Query() query: QueryCashSessionsDto) {
    return this.cashSessionsService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Detalle de sesión con resumen' })
  findOne(@Param('id') id: string) {
    return this.cashSessionsService.findOne(id);
  }

  @Post()
  @RequirePermissions('cash:manage')
  @ApiOperation({ summary: 'Abrir sesión de caja' })
  open(@Body() dto: OpenCashSessionDto) {
    return this.cashSessionsService.open(dto);
  }

  @Patch(':id/close')
  @RequirePermissions('cash:manage')
  @ApiOperation({ summary: 'Cerrar sesión de caja (corte)' })
  close(@Param('id') id: string, @Body() dto: CloseCashSessionDto) {
    return this.cashSessionsService.close(id, dto);
  }
}

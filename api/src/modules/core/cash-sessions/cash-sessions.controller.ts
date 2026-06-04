import { Controller, Get, Post, Patch, Param, Body, Query, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { CashSessionsService } from './cash-sessions.service';
import { OpenCashSessionDto } from './dto/open-session.dto';
import { CloseCashSessionDto } from './dto/close-session.dto';
import { CloseWithAuthDto } from './dto/close-with-auth.dto';
import { QueryCashSessionsDto } from './dto/query-sessions.dto';
import { CreateManualMovementDto } from './dto/create-movement.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { VerifyAuthDto } from './dto/verify-auth.dto';

@ApiTags('Cash Sessions')
@ApiBearerAuth()
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Get('active')
  @HttpCode(200)
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Sesión activa actual' })
  async getActive(@Query('branchId') branchId?: string) {
    const session = await this.cashSessionsService.getActive(branchId);
    return session ?? {};
  }

  @Post('active/movement')
  @RequirePermissions('cash:manage')
  @ApiOperation({ summary: 'Registrar movimiento manual de efectivo (ingreso/egreso)' })
  createManualMovement(@Body() dto: CreateManualMovementDto) {
    return this.cashSessionsService.createManualMovement(dto);
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
  @RequirePermissions('pos.cash:open')
  @ApiOperation({ summary: 'Abrir sesión de caja' })
  open(@Body() dto: OpenCashSessionDto) {
    return this.cashSessionsService.open(dto);
  }

  @Patch(':id/close')
  @RequirePermissions('pos.cash:close')
  @ApiOperation({ summary: 'Cerrar sesión de caja (corte)' })
  close(@Param('id') id: string, @Body() dto: CloseCashSessionDto) {
    return this.cashSessionsService.close(id, dto);
  }

  @Post('verify-auth')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('pos.cash:close')
  @ApiOperation({ summary: 'Verificar credenciales de autorizador para cierre de caja' })
  verifyCloseAuth(@Body() dto: VerifyAuthDto) {
    return this.cashSessionsService.verifyCloseAuth(dto);
  }

  @Patch(':id/close-authorized')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermissions('pos.cash:close')
  @ApiOperation({ summary: 'Cerrar sesión con autorización de administrador' })
  closeWithAuth(@Param('id') id: string, @Body() dto: CloseWithAuthDto) {
    return this.cashSessionsService.closeWithAuth(id, dto);
  }
}

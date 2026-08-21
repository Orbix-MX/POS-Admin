import { Controller, Get, Post, Patch, Param, Body, Query, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { CashSessionsService } from './cash-sessions.service';
import { OpenCashSessionDto } from './dto/open-session.dto';
import { CreateCashRegisterDto, UpdateCashRegisterDto } from './dto/cash-register.dto';
import { CloseCashSessionDto } from './dto/close-session.dto';
import { CloseWithAuthDto } from './dto/close-with-auth.dto';
import { QueryCashSessionsDto } from './dto/query-sessions.dto';
import { CreateManualMovementDto } from './dto/create-movement.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { VerifyAuthDto } from './dto/verify-auth.dto';
import { WithdrawForSuppliesDto } from './dto/withdraw-supplies.dto';
import { CreateCashCountDto } from './dto/create-count.dto';
import { AuthorizePinDto } from './dto/authorize-pin.dto';
import { WithdrawCashDto } from './dto/withdraw-cash.dto';

@ApiTags('Cash Sessions')
@ApiBearerAuth()
@Controller('cash-sessions')
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Get('active')
  @HttpCode(200)
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Sesión activa actual' })
  async getActive(
    @Query('branchId') branchId?: string,
    @Query('cashRegisterId') cashRegisterId?: string,
  ) {
    const session = await this.cashSessionsService.getActive(branchId, cashRegisterId);
    return session ?? {};
  }

  @Post('active/movement')
  @RequirePermissions('cash:manage')
  @ApiOperation({ summary: 'Registrar movimiento manual de efectivo (ingreso/egreso)' })
  createManualMovement(@Body() dto: CreateManualMovementDto) {
    return this.cashSessionsService.createManualMovement(dto);
  }

  @Post('active/withdraw-supplies')
  // Sacar efectivo es más sensible que cerrar caja; antes bastaba pos:access (CASH-008).
  @RequirePermissions('pos.cash:withdraw')
  @ApiOperation({ summary: 'Retiro de efectivo para compra de insumos (requiere autorización admin)' })
  withdrawForSupplies(@Body() dto: WithdrawForSuppliesDto) {
    return this.cashSessionsService.withdrawForSupplies(dto);
  }

  // Sin @RequirePermissions: el guard global rechazaría al cajero antes de que
  // el servicio pueda pedir el PIN del supervisor. La autorización se resuelve
  // dentro (permiso propio del usuario, o PIN de un empleado que lo tenga), así
  // que nadie sin respaldo llega a ejecutar la operación.
  @Patch(':id/start-count')
  @ApiOperation({ summary: 'Congelar la caja para arquear (ABIERTA → EN_ARQUEO)' })
  startCount(@Param('id') id: string, @Body() dto?: AuthorizePinDto) {
    return this.cashSessionsService.startCount(id, dto?.authorizerPin);
  }

  // Reanudar cierra el paréntesis del arqueo. Va por el mismo permiso —y el
  // mismo PIN— que congelarla: si no, un cajero sin permiso dejaría la caja
  // parada sin poder devolverla a operación.
  @Patch(':id/resume')
  @ApiOperation({ summary: 'Volver a operar tras un arqueo de control (EN_ARQUEO → ABIERTA)' })
  resumeOperation(@Param('id') id: string, @Body() dto?: AuthorizePinDto) {
    return this.cashSessionsService.resumeOperation(id, dto?.authorizerPin);
  }

  @Get('registers')
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Cajas físicas de la sucursal, con su sesión viva si la hay' })
  listRegisters() {
    return this.cashSessionsService.listRegisters();
  }

  @Get('registers/capacity')
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Sesiones de caja abiertas en la sucursal contra el tope del plan' })
  getCashSessionCapacity() {
    return this.cashSessionsService.getCashSessionCapacity();
  }

  @Post('registers')
  @RequirePermissions('cash:manage')
  @ApiOperation({ summary: 'Dar de alta una caja física en la sucursal' })
  createRegister(@Body() dto: CreateCashRegisterDto) {
    return this.cashSessionsService.createRegister(dto);
  }

  @Patch('registers/:id')
  @RequirePermissions('cash:manage')
  @ApiOperation({ summary: 'Renombrar o desactivar una caja física' })
  updateRegister(@Param('id') id: string, @Body() dto: UpdateCashRegisterDto) {
    return this.cashSessionsService.updateRegister(id, dto);
  }

  @Post('active/withdraw')
  @RequirePermissions('pos.cash:withdraw')
  @ApiOperation({ summary: 'Retirar efectivo del cajón (traslado a caja fuerte/banco)' })
  withdrawCash(@Body() dto: WithdrawCashDto) {
    return this.cashSessionsService.withdrawCash(dto);
  }

  // Sin @RequirePermissions: el guard global rechazaría al cajero antes de que
  // el servicio pueda pedir el PIN del supervisor. La autorización se resuelve
  // dentro (permiso propio del usuario, o PIN de un empleado que lo tenga), así
  // que nadie sin respaldo llega a ejecutar la operación.
  @Post('active/count')
  @ApiOperation({ summary: 'Registrar arqueo físico sobre la caja abierta (parcial o final)' })
  createCount(@Body() dto: CreateCashCountDto) {
    return this.cashSessionsService.createCount(dto);
  }

  @Get(':id/counts')
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'Arqueos registrados en una sesión' })
  listCounts(@Param('id') id: string) {
    return this.cashSessionsService.listCounts(id);
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

  // Sin @RequirePermissions: el guard global rechazaría al cajero antes de que
  // el servicio pueda pedir el PIN del supervisor. La autorización se resuelve
  // dentro (permiso propio del usuario, o PIN de un empleado que lo tenga), así
  // que nadie sin respaldo llega a ejecutar la operación.
  @Patch(':id/close')
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

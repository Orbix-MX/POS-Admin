import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Invitations')
@Controller()
export class InvitationsController {
  constructor(
    private readonly invitations: InvitationsService,
    private readonly jwt: JwtService,
  ) {}

  // ── Administración del tenant ───────────────────────────────────────────────

  @Post('users/invitations')
  @ApiBearerAuth()
  @RequirePermissions('users:create')
  @ApiOperation({ summary: 'Invitar a alguien a unirse a la empresa' })
  invite(@Body() dto: CreateInvitationDto) {
    return this.invitations.invite(dto);
  }

  @Get('users/invitations')
  @ApiBearerAuth()
  @RequirePermissions('users:view')
  @ApiOperation({ summary: 'Invitaciones pendientes de la empresa' })
  listPending() {
    return this.invitations.listPending();
  }

  @Delete('users/invitations/:id')
  @ApiBearerAuth()
  @RequirePermissions('users:create')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar una invitación pendiente' })
  revoke(@Param('id') id: string) {
    return this.invitations.revoke(id);
  }

  // ── Aceptación (desde el enlace del correo) ─────────────────────────────────
  //
  // Públicos porque quien abre el enlace puede no tener sesión —y si el correo
  // no tenía cuenta, ni siquiera existe todavía—. Van con rate limit porque el
  // token viaja en la URL y es lo único que protege el recurso.

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('invitations/:token')
  @ApiOperation({ summary: 'Ver una invitación antes de aceptarla' })
  preview(@Param('token') token: string) {
    return this.invitations.preview(token);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invitations/:token/accept')
  @ApiOperation({ summary: 'Aceptar la invitación y unirse a la empresa' })
  accept(
    @Param('token') token: string,
    @Body() dto: AcceptInvitationDto,
    @Req() req: { headers: Record<string, string | undefined> },
  ) {
    // La ruta es pública —quien acepta puede no tener cuenta todavía—, así que
    // `JwtAuthGuard` no corre y no hay `req.user`. Si de todos modos llega una
    // sesión, se valida aquí: es lo que permite exigir que quien acepta sea el
    // dueño de la cuenta invitada cuando esa cuenta ya existe.
    return this.invitations.accept(token, dto, this.optionalUserId(req));
  }

  /** userId del JWT si la petición trae uno válido; undefined en cualquier otro caso. */
  private optionalUserId(req: { headers: Record<string, string | undefined> }): string | undefined {
    const header = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;

    try {
      const payload = this.jwt.verify<{ sub?: string; typ?: string }>(header.slice(7));
      // Un token de operador (PIN) identifica a un empleado, no a una cuenta.
      if (payload.typ === 'operator') return undefined;
      return payload.sub;
    } catch {
      // Token caducado o inválido: se trata como si no hubiera sesión, y el
      // servicio pedirá iniciarla.
      return undefined;
    }
  }
}

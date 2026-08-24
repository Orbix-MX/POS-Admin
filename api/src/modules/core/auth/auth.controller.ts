import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  ProfileResponseDto,
  SelectTenantResponseDto,
  SelectBranchResponseDto,
  CapabilitiesResponseDto,
  RefreshResponseDto,
} from './dto/auth-response.dto';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { ExchangeOAuthTicketDto } from './dto/exchange-oauth-ticket.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import type { GoogleProfile } from './strategies/google.strategy';
import { OAuthTicketService } from './services/oauth-ticket.service';
import { GoogleLinkTicketService } from './services/google-link-ticket.service';
import { MfaService } from './services/mfa.service';
import { MfaVerifyDto, MfaCodeDto } from './dto/mfa.dto';
import { PasswordResetService } from './services/password-reset.service';
import { Public } from '../../../common/decorators/public.decorator';
import { AllowInvalidLicense } from '../../../common/decorators/allow-invalid-license.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantRole, TenantPlan } from '@prisma/client';
import { NoPermissionsRequired } from '../../../common/decorators/no-permissions-required.decorator';

type AuthUser = {
  id: string;
  email: string;
  tenantId?: string;
  tenantRole?: TenantRole;
  branchId?: string;
  plan?: TenantPlan;
  enabledModules?: string[];
};

@ApiTags('Auth')
@Controller('auth')
// Session endpoints stay reachable even with an invalid license so users can
// read their state, switch to a licensed tenant, or log out. Per-tenant entry
// is still gated inside selectTenant.
@AllowInvalidLicense()
export class AuthController {
  constructor(
    private authService: AuthService,
    private oauthTickets: OAuthTicketService,
    private googleLinkTickets: GoogleLinkTicketService,
    private mfa: MfaService,
    private passwordReset: PasswordResetService,
    private config: ConfigService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Login — returns preliminary JWT + available tenants' })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  // ── MFA (TOTP, opcional por usuario) ─────────────────────────────────────────

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('mfa/verify')
  @ApiOperation({ summary: 'Segundo paso del login: canjea el ticket de MFA + código por la sesión' })
  async verifyMfa(@Body() dto: MfaVerifyDto): Promise<AuthResponseDto> {
    return this.authService.completeMfaLogin(dto.mfaTicket, dto.code);
  }

  @NoPermissionsRequired()
  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Genera un secreto TOTP nuevo (sin activar MFA todavía)' })
  async setupMfa(@CurrentUser() user: AuthUser): Promise<{ secret: string; otpauthUrl: string }> {
    return this.mfa.startSetup(user.id, user.email);
  }

  @NoPermissionsRequired()
  @Post('mfa/confirm')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirma el setup con el primer código y activa MFA' })
  async confirmMfa(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto): Promise<{ backupCodes: string[] }> {
    return this.mfa.confirmSetup(user.id, dto.code);
  }

  @NoPermissionsRequired()
  @Post('mfa/disable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactiva MFA — requiere un código válido' })
  async disableMfa(@CurrentUser() user: AuthUser, @Body() dto: MfaCodeDto): Promise<{ message: string }> {
    await this.mfa.disable(user.id, dto.code);
    return { message: 'MFA desactivado' };
  }

  // ── Reseteo de contraseña ────────────────────────────────────────────────────
  //
  // La respuesta de forgot-password es idéntica exista o no el correo: decir
  // "no encontrado" confirmaría qué correos están registrados en la
  // plataforma. El throttle es agresivo porque, a diferencia de login, este
  // endpoint no tiene el bloqueo por cuenta como segunda barrera.

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Solicitar reseteo de contraseña por correo' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.passwordReset.requestReset(dto.email);
    return { message: 'Si el correo existe, se envió un enlace para restablecer la contraseña.' };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('reset-password/:token')
  @ApiOperation({ summary: 'Comprobar si un enlace de reseteo sigue siendo válido' })
  async checkResetToken(@Param('token') token: string): Promise<{ valid: true }> {
    await this.passwordReset.checkValid(token);
    return { valid: true };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password/:token')
  @ApiOperation({ summary: 'Restablecer la contraseña con el token del correo' })
  async resetPassword(
    @Param('token') token: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordReset.resetPassword(token, dto.newPassword);
    return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a new access token (rotates refresh token)' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @NoPermissionsRequired()
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout — revokes current access token and (optionally) the refresh token' })
  async logout(
    @Headers('authorization') authHeader: string,
    @Body() dto: LogoutDto,
  ): Promise<{ message: string }> {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    await this.authService.logout(token, dto?.refreshToken);
    return { message: 'Logged out successfully' };
  }

  // ── Google OAuth (authorization code + redirect) ───────────────────────────
  //
  //   navegador → GET /auth/google?redirect=<app>
  //     → consentimiento en Google
  //       → GET /auth/google/callback
  //         → 302 <app>/auth/callback?ticket=<uso único>
  //           → POST /auth/oauth/exchange  → sesión (igual que /auth/login)
  //
  // El JWT nunca viaja en la URL: solo el ticket, de un solo uso y vida corta.

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Inicia el flujo de acceso con Google (redirige a Google)' })
  googleAuth(): void {
    // El guard redirige; este cuerpo nunca se ejecuta.
  }

  /**
   * Emite el ticket que autoriza "Vincular con Google" para el usuario ya
   * autenticado. El frontend lo agrega como `?linkTicket=` al navegar a
   * `GET /auth/google` — ver GoogleOAuthGuard y GoogleLinkTicketService.
   */
  @NoPermissionsRequired()
  @Post('google/link-start')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Emitir ticket para vincular Google a la sesión actual' })
  async startGoogleLink(@CurrentUser() user: AuthUser): Promise<{ token: string }> {
    const token = await this.googleLinkTickets.issue(user.id);
    return { token };
  }

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  @ApiOperation({ summary: 'Callback de Google — redirige al frontend con un ticket de un solo uso' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') state?: string,
  ): Promise<void> {
    const { redirect: target, linkTicket } = this.decodeOAuthState(state);

    try {
      const profile = req.user as GoogleProfile;
      const userId = linkTicket
        ? await this.authService.linkGoogleIdentity(linkTicket, profile)
        : await this.authService.resolveGoogleIdentity(profile);
      const ticket = await this.oauthTickets.issue(userId);
      res.redirect(`${target}/auth/callback?ticket=${encodeURIComponent(ticket)}`);
    } catch (e) {
      const message = e instanceof HttpException ? (e.getResponse() as { message?: string })?.message : undefined;
      res.redirect(
        `${target}/auth/callback?error=${encodeURIComponent(
          message ?? 'No fue posible completar el acceso con Google',
        )}`,
      );
    }
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('oauth/exchange')
  @ApiOperation({ summary: 'Canjea el ticket del callback por la sesión (JWT preliminar + tenants)' })
  exchangeOAuthTicket(@Body() dto: ExchangeOAuthTicketDto): Promise<AuthResponseDto> {
    return this.authService.exchangeOAuthTicket(dto.ticket);
  }

  /**
   * `state` viaja como `{ r: redirect, lt: linkTicket }` en base64url (ver
   * `GoogleOAuthGuard.getAuthenticateOptions`) — Google solo devuelve un
   * único string opaco, así que empaquetar es la única forma de mandarle dos
   * datos propios. `r` solo se acepta si está en la allowlist: sin eso el
   * `state` sería un open redirect con un ticket de sesión válido adjunto —
   * un robo de cuenta de un clic.
   */
  private decodeOAuthState(state?: string): { redirect: string; linkTicket?: string } {
    const fallback = this.config.get<string>('googleOAuth.defaultRedirect') as string;
    if (!state) return { redirect: fallback };

    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
        r?: string;
        lt?: string;
      };
      const allowed = this.config.get<string[]>('googleOAuth.allowedRedirects') ?? [];
      const candidate = (parsed.r ?? '').trim().replace(/\/$/, '');
      return {
        redirect: allowed.includes(candidate) ? candidate : fallback,
        linkTicket: parsed.lt || undefined,
      };
    } catch {
      return { redirect: fallback };
    }
  }

  @NoPermissionsRequired()
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear o cambiar la contraseña del usuario autenticado' })
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
    return { message: 'Contraseña actualizada' };
  }

  @NoPermissionsRequired()
  @Delete('google')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desvincular la cuenta de Google del usuario actual' })
  async unlinkGoogle(@CurrentUser() user: AuthUser): Promise<{ message: string }> {
    await this.authService.unlinkGoogle(user.id);
    return { message: 'Cuenta de Google desvinculada' };
  }

  @NoPermissionsRequired()
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with active tenant/branch' })
  async getProfile(@CurrentUser() user: AuthUser): Promise<ProfileResponseDto> {
    return this.authService.getProfile(user.id);
  }

  @NoPermissionsRequired()
  @Patch('select-tenant/:slug')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select active tenant — returns new JWT with tenantId embedded' })
  selectTenant(
    @CurrentUser() user: AuthUser,
    @Param('slug') slug: string,
  ): Promise<SelectTenantResponseDto> {
    return this.authService.selectTenant(user.id, user.email, slug);
  }

  @NoPermissionsRequired()
  @Patch('select-branch/:branchId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Select active branch — returns new JWT with branchId embedded' })
  selectBranch(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
  ): Promise<SelectBranchResponseDto> {
    return this.authService.selectBranch(
      user.id,
      user.email,
      user.tenantId,
      user.tenantRole,
      branchId,
      user.plan,
      user.enabledModules,
    );
  }

  @NoPermissionsRequired()
  @Get('me/capabilities')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get plan capabilities for current tenant session' })
  getCapabilities(@CurrentUser() user: AuthUser): Promise<CapabilitiesResponseDto> {
    return this.authService.getCapabilities(
      user.plan ?? 'FREE',
      user.enabledModules ?? [],
      user.tenantId,
    );
  }
}

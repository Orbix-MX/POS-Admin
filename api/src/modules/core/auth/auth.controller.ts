import {
  Controller,
  Post,
  Get,
  Patch,
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
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import type { GoogleProfile } from './strategies/google.strategy';
import { OAuthTicketService } from './services/oauth-ticket.service';
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

  @Public()
  @UseGuards(GoogleOAuthGuard)
  @Get('google/callback')
  @ApiOperation({ summary: 'Callback de Google — redirige al frontend con un ticket de un solo uso' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Query('state') state?: string,
  ): Promise<void> {
    const target = this.resolveRedirect(state);

    try {
      const profile = req.user as GoogleProfile;
      const userId = await this.authService.resolveGoogleIdentity(profile);
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
   * Solo se redirige a orígenes de la allowlist. Sin esta validación el `state`
   * convertiría el callback en un open redirect con un ticket de sesión válido
   * adjunto — es decir, en un robo de cuenta de un clic.
   */
  private resolveRedirect(state?: string): string {
    const fallback = this.config.get<string>('googleOAuth.defaultRedirect') as string;
    if (!state) return fallback;

    const allowed = this.config.get<string[]>('googleOAuth.allowedRedirects') ?? [];
    const candidate = state.trim().replace(/\/$/, '');
    return allowed.includes(candidate) ? candidate : fallback;
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

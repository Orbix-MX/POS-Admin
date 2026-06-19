import { Controller, Post, Get, Patch, Body, Param, Headers, UseGuards } from '@nestjs/common';
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
import { Public } from '../../../common/decorators/public.decorator';
import { AllowInvalidLicense } from '../../../common/decorators/allow-invalid-license.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TenantRole, TenantPlan } from '@prisma/client';

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
  constructor(private authService: AuthService) {}

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

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile with active tenant/branch' })
  async getProfile(@CurrentUser() user: AuthUser): Promise<ProfileResponseDto> {
    return this.authService.getProfile(user.id);
  }

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

import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAuthResponseDto, PlatformUserResponseDto } from './dto/platform-auth-response.dto';
import { PlatformJwtAuthGuard } from '../common/guards/platform-jwt-auth.guard';
import { CurrentPlatformUser } from '../common/decorators/current-platform-user.decorator';
import type { PlatformUser } from '@prisma/client';

type PlatformActor = Pick<PlatformUser, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'status' | 'createdAt'>;

@ApiTags('Platform Auth')
@Controller('platform/auth')
@Public()
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Platform admin login' })
  login(@Body() dto: PlatformLoginDto): Promise<PlatformAuthResponseDto> {
    return this.platformAuthService.login(dto);
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current platform user profile' })
  me(@CurrentPlatformUser() user: PlatformActor): PlatformUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }
}

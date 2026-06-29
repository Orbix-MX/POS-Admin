import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'The opaque refresh token previously issued at login.' })
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to revoke (mobile). Optional.' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

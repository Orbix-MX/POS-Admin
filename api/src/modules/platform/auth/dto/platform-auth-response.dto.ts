import { ApiProperty } from '@nestjs/swagger';
import { PlatformUserRole, PlatformUserStatus } from '@prisma/client';

export class PlatformUserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ enum: PlatformUserRole }) role: PlatformUserRole;
  @ApiProperty({ enum: PlatformUserStatus }) status: PlatformUserStatus;
  @ApiProperty() createdAt: Date;
}

export class PlatformAuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty({ type: PlatformUserResponseDto }) user: PlatformUserResponseDto;
}

import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';

export class ActivateDeviceDto {
  @ApiProperty({ description: 'Stable client-generated device id / fingerprint.' })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @ApiPropertyOptional({ description: 'Friendly device name (e.g. "Caja 1 — iPad").' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: DeviceType })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;
}

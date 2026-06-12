import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';

/**
 * Public device activation (from the app). Provide exactly one of
 * `activationToken` (scanned QR) or `licenseKey` (manual entry), plus device
 * metadata captured by the client.
 */
export class ActivateDeviceDto {
  @ApiProperty({ description: 'Stable client-generated device id / fingerprint.' })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @ApiPropertyOptional({ description: 'Enrollment token read from a QR.' })
  @IsOptional()
  @IsString()
  activationToken?: string;

  @ApiPropertyOptional({ description: 'License key entered manually (e.g. ORBX-XXXX-XXXX-XXXX-XXXX).' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  licenseKey?: string;

  @ApiPropertyOptional({ description: 'Friendly device name.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ description: 'Hardware model (e.g. "iPad 9th gen").' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiPropertyOptional({ description: 'OS + version (e.g. "iOS 18.2").' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  os?: string;

  @ApiPropertyOptional({ description: 'App version (e.g. "1.0.0").' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;

  @ApiPropertyOptional({ enum: DeviceType })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;
}

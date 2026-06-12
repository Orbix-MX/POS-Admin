import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateDeviceDto {
  @ApiProperty({ description: 'Stable client-generated device id / fingerprint.' })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @ApiPropertyOptional({ description: 'Current app version (recorded on the device).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

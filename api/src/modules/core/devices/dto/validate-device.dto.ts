import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateDeviceDto {
  @ApiProperty({ description: 'Stable client-generated device id / fingerprint.' })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @ApiPropertyOptional({
    description:
      'Durable device credential the app received on activation. Proves the caller is that device; ' +
      'the response never repeats it. Without it the device is reported as not registered (an app that ' +
      'predates this field lands on the activation screen instead of failing as if it were offline).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceToken?: string;

  @ApiPropertyOptional({ description: 'Current app version (recorded on the device).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

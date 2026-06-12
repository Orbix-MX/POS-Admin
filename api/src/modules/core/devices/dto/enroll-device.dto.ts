import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType } from '@prisma/client';

/** Sent by the app (public) after scanning the enrollment QR. */
export class EnrollDeviceDto {
  @ApiProperty({ description: 'Enrollment token read from the QR.' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Stable client-generated device id / fingerprint.' })
  @IsString()
  @MaxLength(128)
  deviceId: string;

  @ApiPropertyOptional({ description: 'Friendly device name (e.g. "Comanda — Tablet Salón").' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ enum: DeviceType })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;
}

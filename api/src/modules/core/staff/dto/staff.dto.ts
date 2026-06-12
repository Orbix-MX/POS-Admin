import { IsString, Matches, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PinLoginDto {
  @ApiProperty({ description: 'Durable device token obtained from /devices/validate or /devices/activate.' })
  @IsString()
  deviceToken: string;

  @ApiProperty({ example: '1234', description: 'Operative PIN (4-6 digits).' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener entre 4 y 6 dígitos.' })
  pin: string;
}

export class AssignPinDto {
  @ApiProperty({ example: '1234' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe tener entre 4 y 6 dígitos.' })
  pin: string;

  @ApiPropertyOptional({ description: 'Operative role id (sources permissions for PIN login).' })
  @IsOptional()
  @IsString()
  roleId?: string;
}

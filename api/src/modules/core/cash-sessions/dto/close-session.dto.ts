import { IsNumber, Min, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloseCashSessionDto {
  @ApiProperty({ example: 1250, description: 'Efectivo MXN contado físicamente' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashCounted: number;

  @ApiPropertyOptional({ example: 20, description: 'Efectivo USD contado físicamente' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashCountedUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

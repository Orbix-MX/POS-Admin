import { IsString, IsOptional, IsBoolean, IsNumber, Min, MaxLength, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateServiceDto {
  @ApiProperty({ example: 'Reparación de PC' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ minimum: 0, example: 250.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: '2 horas' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  estimatedDuration?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  hasVariablePrice?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

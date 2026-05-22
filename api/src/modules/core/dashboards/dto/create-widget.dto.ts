import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateWidgetDto {
  @ApiProperty({ enum: WidgetType })
  @IsEnum(WidgetType)
  widgetType: WidgetType;

  @ApiProperty({ example: 'Ventas del Mes' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @ApiProperty({ example: '/api/reports/sales/monthly' })
  @IsString()
  endpoint: string;

  @ApiPropertyOptional({ default: 'GET' })
  @IsOptional()
  @IsString()
  httpMethod?: string;

  @ApiPropertyOptional({ example: { period: 'last_30_days' } })
  @IsOptional()
  @IsObject()
  defaultParams?: Record<string, unknown>;

  @ApiPropertyOptional({ example: { valueFormat: 'currency', showLegend: true } })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 60, description: 'Auto-refresh interval in seconds. null = no refresh' })
  @IsOptional()
  @IsInt()
  @Min(10)
  refreshSeconds?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

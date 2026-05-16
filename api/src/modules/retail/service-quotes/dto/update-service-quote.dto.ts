import { IsString, IsOptional, IsEnum, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateServiceQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedDeliveryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'] })
  @IsOptional()
  @IsEnum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED'])
  status?: string;
}

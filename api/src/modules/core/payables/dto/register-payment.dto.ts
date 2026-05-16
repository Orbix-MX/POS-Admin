import { IsNumber, Min, IsOptional, IsString, MaxLength, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierPaymentMethod } from '@prisma/client';

export class RegisterPayablePaymentDto {
  @ApiProperty({ example: 1500.0, description: 'Monto a pagar' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: SupplierPaymentMethod, description: 'Método de pago' })
  @IsEnum(SupplierPaymentMethod)
  paymentMethod: SupplierPaymentMethod;

  @ApiPropertyOptional({ example: '2026-05-04T12:00:00Z' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'TRANS-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

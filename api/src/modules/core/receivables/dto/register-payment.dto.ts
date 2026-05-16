import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterCxCPaymentDto {
  @ApiProperty({ example: 500.0, description: 'Monto a abonar' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'CASH', description: 'Método de pago: CASH, TRANSFER, CARD' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  paymentMethod: string;

  @ApiPropertyOptional({ example: 'REF-12345' })
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

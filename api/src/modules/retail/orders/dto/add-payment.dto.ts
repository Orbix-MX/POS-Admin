import {
  IsString, IsOptional, IsEnum, IsArray, ValidateNested, IsNumber, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePaymentSplitDto } from './create-order.dto';

export class AddPaymentDto {
  @ApiProperty({ type: [CreatePaymentSplitDto], description: 'Pagos a registrar' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentSplitDto)
  payments: CreatePaymentSplitDto[];

  @ApiPropertyOptional({ minimum: 0, description: 'Cambio total a devolver al cliente' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  changeAmount?: number;

  @ApiPropertyOptional({ enum: ['MXN', 'USD'] })
  @IsOptional()
  @IsEnum(['MXN', 'USD'])
  changeCurrency?: 'MXN' | 'USD';

  @ApiPropertyOptional({ description: 'Notas del pago' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    enum: ['DOWN_PAYMENT', 'LAYAWAY_DEPOSIT', 'BALANCE_PAYMENT'],
    description: 'Concepto del pago. Default: BALANCE_PAYMENT',
  })
  @IsOptional()
  @IsEnum(['DOWN_PAYMENT', 'LAYAWAY_DEPOSIT', 'BALANCE_PAYMENT'])
  paymentConcept?: string;
}

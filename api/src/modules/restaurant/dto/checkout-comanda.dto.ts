import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutPaymentDto {
  @ApiProperty({ example: 'CASH', description: 'Método de pago: CASH, CARD, TRANSFER' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({ example: 'MXN', enum: ['MXN', 'USD'], required: false })
  @IsOptional()
  @IsEnum(['MXN', 'USD'])
  currency?: 'MXN' | 'USD';

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 200.0, required: false })
  @IsOptional()
  @IsNumber()
  amountReceived?: number;

  @ApiProperty({ example: 50.0, required: false })
  @IsOptional()
  @IsNumber()
  changeGiven?: number;
}

export class CheckoutComandaDto {
  @ApiProperty({ type: [CheckoutPaymentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments: CheckoutPaymentDto[];
}

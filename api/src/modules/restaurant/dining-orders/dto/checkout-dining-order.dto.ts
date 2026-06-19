import { IsArray, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CheckoutPaymentDto } from '../../dto/checkout-comanda.dto';

export class CheckoutDiningOrderDto {
  @ApiProperty({ type: [CheckoutPaymentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments: CheckoutPaymentDto[];

  // Optional customer to attach to the generated Order (billing / CxC).
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customerId?: string;
}

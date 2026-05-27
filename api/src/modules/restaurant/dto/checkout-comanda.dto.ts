import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutComandaDto {
  @ApiProperty({ example: 'CASH', description: 'Método de pago: CASH, CARD, TRANSFER' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  paymentMethod: string;
}

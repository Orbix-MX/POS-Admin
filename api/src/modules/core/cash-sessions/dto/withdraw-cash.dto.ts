import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Retiro de efectivo del cajón hacia la caja fuerte o el banco.
 *
 * No confundir con `WithdrawForSuppliesDto`, que es una compra de insumos y se
 * registra como gasto: aquel dinero sale del negocio, éste solo cambia de lugar.
 */
export class WithdrawCashDto {
  @ApiProperty({ example: 4500, description: 'Monto a retirar' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ enum: ['MXN', 'USD'], default: 'MXN' })
  @IsOptional()
  @IsEnum(['MXN', 'USD'])
  currency?: 'MXN' | 'USD';

  @ApiProperty({ example: 'Traslado a caja fuerte', description: 'Motivo del retiro (obligatorio)' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SupplyPurchaseLineDto {
  @ApiProperty({ description: 'ID del insumo comprado' })
  @IsUUID()
  supplyId: string;

  @ApiProperty({ description: 'Cantidad comprada, en la unidad de inventario del insumo' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity: number;

  @ApiProperty({ description: 'Costo total pagado por esta línea (cantidad × precio unitario)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lineCost: number;
}

export class WithdrawForSuppliesDto {
  @ApiProperty({ type: [SupplyPurchaseLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplyPurchaseLineDto)
  items: SupplyPurchaseLineDto[];

  @ApiPropertyOptional({ description: 'Notas / proveedor / referencia del retiro' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: 'admin@tienda.com', description: 'Email del usuario autorizador' })
  @IsEmail()
  authEmail: string;

  @ApiProperty({ description: 'Contraseña del usuario autorizador' })
  @IsString()
  @MinLength(1)
  authPassword: string;
}

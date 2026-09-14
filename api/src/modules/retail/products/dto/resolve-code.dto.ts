import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * El código que acaba de leer la cámara, o el que se tecleó en su lugar.
 *
 * El tope de 64 no es decorativo: un código de barras comercial no pasa de 14
 * dígitos y el SKU más largo que admite el alta cabe de sobra, así que lo que
 * llegue más largo es basura de un lector mal configurado y no merece una
 * consulta a la base.
 */
export class ResolveCodeDto {
  @ApiProperty({ example: '7501055300112', description: 'Barcode or SKU to resolve' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code!: string;
}

import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProductDraftRequestDto {
  @ApiProperty({
    description: 'Descripción en lenguaje natural del producto a dar de alta',
    example: 'Quiero agregar Coca-Cola de 600 ml, me cuesta 15 pesos y la vendo en 22.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  message: string;
}

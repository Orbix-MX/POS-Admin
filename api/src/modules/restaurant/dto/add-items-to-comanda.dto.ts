import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ComandaItemDto } from './create-comanda.dto';

export class AddItemsToComandaDto {
  @ApiProperty({ type: [ComandaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComandaItemDto)
  items: ComandaItemDto[];
}

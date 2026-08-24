import { IsEnum, IsOptional } from 'class-validator';
import { BusinessVertical } from '@prisma/client';

export class ListTemplatesDto {
  // Si se omite, se usa el vertical del tenant actual.
  @IsOptional()
  @IsEnum(BusinessVertical)
  vertical?: BusinessVertical;
}

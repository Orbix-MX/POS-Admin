import { IsOptional, IsBoolean, IsObject, IsArray, IsString, ArrayNotEmpty } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class UpdateSiteSectionDto {
  @ApiPropertyOptional({ description: 'Contenido de la sección — la forma depende de su sectionType' })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ReorderSiteSectionsDto {
  @ApiProperty({ description: 'IDs de TODAS las secciones del tenant, en el nuevo orden deseado' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  order: string[];
}

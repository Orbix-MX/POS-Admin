import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SupplyStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class QuerySupplyDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SupplyStatus })
  @IsOptional()
  @IsEnum(SupplyStatus)
  status?: SupplyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

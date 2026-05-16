import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountPayableStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class QueryPayablesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ enum: AccountPayableStatus })
  @IsOptional()
  @IsEnum(AccountPayableStatus)
  status?: AccountPayableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

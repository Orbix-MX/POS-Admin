import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CashSessionStatus } from '@prisma/client';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

export class QueryCashSessionsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CashSessionStatus })
  @IsOptional()
  @IsEnum(CashSessionStatus)
  status?: CashSessionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

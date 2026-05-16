import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { AccountReceivableStatus } from '@prisma/client';

export class QueryReceivablesDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(AccountReceivableStatus)
  status?: AccountReceivableStatus;
}

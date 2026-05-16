import { IsOptional, IsString, IsEnum } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { PurchaseOrderStatus } from '@prisma/client';

export class QueryPurchaseOrdersDto extends PaginationDto {
  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString()
  search?: string;
}

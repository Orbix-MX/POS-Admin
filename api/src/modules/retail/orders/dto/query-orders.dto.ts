import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../../common/dto/pagination.dto';
import { OrderOrigin, OrderStatus } from '@prisma/client';

export class QueryOrdersDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(OrderOrigin)
  orderOrigin?: OrderOrigin;
}

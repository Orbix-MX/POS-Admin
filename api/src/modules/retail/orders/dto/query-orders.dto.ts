import { IsOptional, IsEnum, IsUUID, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
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

  /**
   * Sucursal de la venta. El listado no lo filtraba, así que un tenant con
   * varias sucursales veía las ventas de todas mezcladas en el historial de
   * una sola.
   */
  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  /**
   * Rango por `createdAt`, en instantes **absolutos** (ISO 8601 con zona).
   *
   * El cliente manda el rango ya convertido desde su hora local: el servidor
   * compara en UTC, y un "hoy" calculado aquí desfasaría seis horas para un
   * negocio en UTC−6 — las ventas de la tarde caerían en el día siguiente.
   *
   * `dateFrom` es inclusivo y `dateTo` exclusivo, para que dos rangos
   * consecutivos no cuenten dos veces la venta del límite.
   */
  @ApiPropertyOptional({ description: 'Desde (inclusive), ISO 8601 con zona' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Hasta (exclusive), ISO 8601 con zona' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}

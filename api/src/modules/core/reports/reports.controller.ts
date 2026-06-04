import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ServiceQuoteStatus } from '@prisma/client';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RequireModule } from '../../../common/guards/require-module.guard';
import { ReportsService } from './reports.service';

class MonthlyQuotesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsEnum(ServiceQuoteStatus)
  status?: ServiceQuoteStatus;
}

class TopProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;

  @IsOptional()
  @IsIn(['quantity', 'revenue'])
  orderBy?: 'quantity' | 'revenue';
}

class MonthlySalesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsString()
  branchId?: string;
}

@RequireModule('reportes')
@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('profit/monthly')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Utilidad del mes',
    description:
      'Returns a COUNTER-format WidgetResponse with the monthly profit (sales minus purchase expenses), including the individual totals and month-over-month comparison.',
  })
  @ApiQuery({ name: 'year',  required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month', required: false, description: 'Month 1-12 (default: current)' })
  monthlyProfit(@Query() query: MonthlyQuotesQueryDto) {
    return this.reportsService.monthlyProfit({
      year:  query.year,
      month: query.month,
    });
  }

  @Get('expenses/monthly')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Gastos del mes',
    description:
      'Returns a COUNTER-format WidgetResponse with total purchase expenses for the requested month (excludes BORRADOR and CANCELADA orders), including month-over-month comparison.',
  })
  @ApiQuery({ name: 'year',  required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month', required: false, description: 'Month 1-12 (default: current)' })
  monthlyExpenses(@Query() query: MonthlyQuotesQueryDto) {
    return this.reportsService.monthlyExpenses({
      year:  query.year,
      month: query.month,
    });
  }

  @Get('products/top')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Productos más vendidos',
    description:
      'Returns a RANKING-format WidgetResponse with the top N best-selling products for the requested month, ordered by units sold or revenue.',
  })
  @ApiQuery({ name: 'year',     required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month',    required: false, description: 'Month 1-12 (default: current)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  @ApiQuery({ name: 'limit',    required: false, description: 'Max results 1-20 (default: 10)' })
  @ApiQuery({ name: 'orderBy',  required: false, enum: ['quantity', 'revenue'], description: 'Sort by units sold or revenue (default: quantity)' })
  topProducts(@Query() query: TopProductsQueryDto) {
    return this.reportsService.topProducts({
      year:     query.year,
      month:    query.month,
      branchId: query.branchId,
      limit:    query.limit,
      orderBy:  query.orderBy,
    });
  }

  @Get('quotes/monthly')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Cotizaciones del mes',
    description:
      'Returns a COUNTER-format WidgetResponse with the count and total value of service quotes created in the requested month, including month-over-month comparison. Optionally filter by status.',
  })
  @ApiQuery({ name: 'year',   required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month',  required: false, description: 'Month 1-12 (default: current)' })
  @ApiQuery({ name: 'status', required: false, enum: ServiceQuoteStatus, description: 'Filter by quote status' })
  monthlyQuotes(@Query() query: MonthlyQuotesQueryDto) {
    return this.reportsService.monthlyQuotes({
      year:   query.year,
      month:  query.month,
      status: query.status,
    });
  }

  @Get('sales/daily')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Ventas por día',
    description:
      'Returns a BAR_CHART-format WidgetResponse with daily sales totals for the requested month. Each point contains the day number, label, total revenue, and order count.',
  })
  @ApiQuery({ name: 'year',     required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month',    required: false, description: 'Month 1-12 (default: current)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  dailySales(@Query() query: MonthlySalesQueryDto) {
    return this.reportsService.dailySales({
      year:     query.year,
      month:    query.month,
      branchId: query.branchId,
    });
  }

  @Get('customers/new')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Clientes nuevos del mes',
    description:
      'Returns a COUNTER-format WidgetResponse with the count of new customers registered in the requested month, including month-over-month comparison.',
  })
  @ApiQuery({ name: 'year',     required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month',    required: false, description: 'Month 1-12 (default: current)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  newCustomers(@Query() query: MonthlySalesQueryDto) {
    return this.reportsService.newCustomers({
      year:     query.year,
      month:    query.month,
      branchId: query.branchId,
    });
  }

  @Get('sales/monthly')
  @RequirePermissions('reports:view')
  @ApiOperation({
    summary: 'Ventas del mes',
    description:
      'Returns a COUNTER-format WidgetResponse with total sales revenue and order count for the requested month, including month-over-month comparison.',
  })
  @ApiQuery({ name: 'year',     required: false, description: 'Year (default: current)' })
  @ApiQuery({ name: 'month',    required: false, description: 'Month 1-12 (default: current)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch ID' })
  monthlySales(@Query() query: MonthlySalesQueryDto) {
    return this.reportsService.monthlySales({
      year:     query.year,
      month:    query.month,
      branchId: query.branchId,
    });
  }
}

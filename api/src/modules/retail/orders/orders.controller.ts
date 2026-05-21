import { Controller, Get, Param, Patch, Body, Query, Post, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { OrderStatus } from '@prisma/client';
import { EmailService } from '../../core/email/email.service';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @RequirePermissions('orders:view')
  @ApiOperation({ summary: 'Get all orders' })
  findAll(@Query() query: QueryOrdersDto) {
    return this.ordersService.findAll(query);
  }

  @Get('stats')
  @RequirePermissions('orders:view')
  @ApiOperation({ summary: 'Get order statistics' })
  getStats() {
    return this.ordersService.getStats();
  }

  @Post()
  @RequirePermissions('orders:create')
  @ApiOperation({ summary: 'Create a new sale (order)' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get(':id')
  @RequirePermissions('orders:view')
  @ApiOperation({ summary: 'Get order by ID' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @RequirePermissions('orders:edit')
  @ApiOperation({ summary: 'Update order status' })
  updateStatus(@Param('id') id: string, @Body('status') status: OrderStatus) {
    return this.ordersService.updateStatus(id, status);
  }

  @Patch(':id/status-payment')
  @RequirePermissions('orders:edit')
  @ApiOperation({ summary: 'Update order status and mark as PAID if fully paid and not credit' })
  updateStatusAndPayment(@Param('id') id: string, @Body('status') status: OrderStatus) {
    return this.ordersService.updateStatusAndPayment(id, status);
  }

  @Post(':id/payments')
  @RequirePermissions('orders:create')
  @ApiOperation({ summary: 'Add payment(s) to an existing order (layaway settlement, partial payment)' })
  addPayment(@Param('id') id: string, @Body() dto: AddPaymentDto) {
    return this.ordersService.addPayment(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('orders:edit')
  @ApiOperation({ summary: 'Cancel an order — reverses inventory, cash and CxC' })
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancelOrder(id, dto.reason);
  }

  @Post(':id/return')
  @RequirePermissions('orders:edit')
  @ApiOperation({ summary: 'Return a sale (full refund) — reverses inventory and cash' })
  returnSale(@Param('id') id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.returnOrder(id, dto.reason);
  }

  @Post(':id/refund')
  @RequirePermissions('refunds:create')
  @ApiOperation({ summary: 'Partial or full refund — creates refund record, EXPENSE cash movement, updates paymentStatus' })
  refundOrder(@Param('id') id: string, @Body() dto: RefundOrderDto) {
    return this.ordersService.refundOrder(id, dto);
  }

  @Post(':id/send-receipt')
  @RequirePermissions('orders:view')
  @ApiOperation({ summary: 'Send order receipt by email' })
  @HttpCode(HttpStatus.OK)
  async sendReceipt(
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    const order = await this.ordersService.findOne(id);
    const result = await this.emailService.sendReceipt(email, order as any);

    return {
      success: result.success,
      message: result.success
        ? 'Ticket enviado correctamente'
        : 'Error al enviar ticket',
      previewUrl: result.previewUrl,
    };
  }
}

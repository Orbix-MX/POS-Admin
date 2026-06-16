import { Module } from '@nestjs/common';
import { OrderCheckoutEngine } from './order-checkout.engine';

/**
 * Shared module exposing the financial checkout engine (cash session + Payment +
 * CashMovement). Imported by any sales channel that closes an Order.
 */
@Module({
  providers: [OrderCheckoutEngine],
  exports: [OrderCheckoutEngine],
})
export class CheckoutModule {}

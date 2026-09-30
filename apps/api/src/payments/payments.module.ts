import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { CashfreeGateway } from './gateways/cashfree.gateway';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { PaymentsController } from './payments.controller';
import { ManualPaymentsService } from './manual-payments.service';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ManualPaymentsService, RefundsService, RazorpayGateway, CashfreeGateway],
})
export class PaymentsModule {}

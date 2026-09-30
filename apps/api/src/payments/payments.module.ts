import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { CashfreeGateway } from './gateways/cashfree.gateway';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, RazorpayGateway, CashfreeGateway],
})
export class PaymentsModule {}

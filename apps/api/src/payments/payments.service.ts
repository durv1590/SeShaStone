import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentProvider, Prisma } from '@prisma/client';
import { paginated } from '../common/dto/pagination.dto';
import { MANUAL_PROVIDERS, OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CashfreeGateway } from './gateways/cashfree.gateway';
import { GatewayPaymentEvent, PaymentGateway } from './gateways/payment-gateway';
import { RazorpayGateway } from './gateways/razorpay.gateway';
import { InitiatePaymentDto, ListPaymentsDto, VerifyPaymentDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly gateways: Partial<Record<PaymentProvider, PaymentGateway>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly config: ConfigService,
    razorpay: RazorpayGateway,
    cashfree: CashfreeGateway,
  ) {
    this.gateways = { RAZORPAY: razorpay, CASHFREE: cashfree };
  }

  /** Creates a gateway order for an unpaid order and returns what the client needs to pay. */
  async initiate(customerId: string, dto: InitiatePaymentDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, customerId },
      include: { customer: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('This order is not awaiting payment');
    }

    const requested =
      dto.provider ?? (this.config.get<string>('payments.defaultProvider') as PaymentProvider);
    const enabled = (await this.settings.get('payments.enabledProviders')) as readonly string[];
    if (!enabled.includes(requested)) {
      throw new BadRequestException('Selected payment method is not available');
    }
    const gateway = this.resolveGateway(requested);
    const address = order.shippingAddress as { phone?: string; fullName?: string };

    const { providerOrderId, clientPayload } = await gateway.createOrder({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      currency: order.currency,
      customer: {
        id: order.customerId,
        email: order.customer.email,
        phone: address.phone ?? order.customer.phone ?? '',
        name: address.fullName ?? order.customer.firstName,
      },
      preferredMethod: requested === PaymentProvider.UPI ? 'upi' : undefined,
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: gateway.provider,
        status: 'PENDING',
        amount: order.total,
        currency: order.currency,
        providerOrderId,
        method: requested === PaymentProvider.UPI ? 'upi' : undefined,
      },
    });

    return { paymentId: payment.id, provider: gateway.provider, providerOrderId, clientPayload };
  }

  /** Handles the storefront's post-checkout callback. Webhooks remain the source of truth. */
  async verify(customerId: string, dto: VerifyPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, order: { customerId } },
    });
    if (!payment?.providerOrderId) throw new NotFoundException('Payment not found');
    const gateway = this.resolveGateway(payment.provider);
    const event = await gateway.verifyClientPayment(payment.providerOrderId, dto.payload);
    if (!event) throw new UnauthorizedException('Payment could not be verified');
    await this.apply(event);
    return this.prisma.order.findUniqueOrThrow({
      where: { id: payment.orderId },
      select: { id: true, orderNumber: true, status: true },
    });
  }

  async handleWebhook(
    provider: string,
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const gateway = this.gateways[provider as PaymentProvider];
    if (!gateway || !rawBody) throw new NotFoundException();
    const event = gateway.parseWebhook(rawBody, headers);
    if (!event) {
      this.logger.warn(`Ignored ${provider} webhook (invalid signature or unhandled event)`);
      return { received: true };
    }
    await this.apply(event);
    return { received: true };
  }

  async adminList(query: ListPaymentsDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.provider && { provider: query.provider }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        omit: { raw: true },
        // Evidence file bytes are never listed; they are fetched one at a time by authorised staff.
        include: {
          order: { select: { id: true, orderNumber: true, customerId: true, status: true } },
          _count: { select: { evidence: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Applies a verified gateway event. Safe to call repeatedly for the same payment. */
  private async apply(event: GatewayPaymentEvent) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { providerOrderId: event.providerOrderId },
      });
      if (!payment || payment.status === 'CAPTURED') return;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: event.status,
          providerPaymentId: event.providerPaymentId ?? payment.providerPaymentId,
          method: event.method ?? payment.method,
          raw: event.raw as Prisma.InputJsonValue,
        },
      });
      if (event.status === 'CAPTURED') {
        const order = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId } });
        if (order.status === OrderStatus.PENDING_PAYMENT) {
          await this.orders.markPaid(tx, order.id);
        } else if (order.status === OrderStatus.CANCELLED) {
          // Paid after the reservation expired — needs a manual refund or re-stock.
          this.logger.error(`Payment captured for cancelled order ${order.orderNumber}`);
        }
      }
    });
  }

  private resolveGateway(provider: PaymentProvider): PaymentGateway {
    // UPI is collected through the store's default gateway with UPI pre-selected.
    const key =
      provider === PaymentProvider.UPI
        ? (this.config.get<string>('payments.defaultProvider') as PaymentProvider)
        : provider;
    if (MANUAL_PROVIDERS.includes(key)) {
      throw new BadRequestException('Pay this order using the UPI / bank details on the order page');
    }
    const gateway = this.gateways[key];
    if (!gateway) throw new BadRequestException(`Unsupported payment provider ${provider}`);
    if (!gateway.isConfigured()) {
      throw new ServiceUnavailableException(`${key} is not configured`);
    }
    return gateway;
  }
}

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
import {
  InitiatePaymentDto,
  ListPaymentsDto,
  SubmitPaymentReferenceDto,
  VerifyPaymentDto,
} from './payments.dto';

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

  // ── Direct UPI / bank transfer ─────────────────────────────

  /** What the customer needs to pay a manual-payment order: UPI ID + deep link, or bank details. */
  async instructions(customerId: string, orderId: string) {
    const payment = await this.manualPayment(customerId, orderId);
    const order = payment.order;
    const s = await this.settings.all();
    const amount = (order.total / 100).toFixed(2);
    const base = {
      provider: payment.provider,
      paymentId: payment.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: payment.status,
      amount: order.total,
      reference: order.orderNumber,
      submittedReference: payment.providerPaymentId,
    };

    if (payment.provider === PaymentProvider.UPI_DIRECT) {
      const payee = String(s['payments.upiPayeeName'] || s['store.legalName']);
      // NPCI deep-link format; the VPA's '@' is left unescaped as some UPI apps don't decode it.
      const upiId = String(s['payments.upiId']);
      const uri =
        `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR` +
        `&tn=${encodeURIComponent(`Order ${order.orderNumber}`)}`;
      return { ...base, upi: { upiId, payeeName: payee, uri } };
    }
    return {
      ...base,
      bank: {
        bankName: s['payments.bankName'],
        accountName: s['payments.bankAccountName'] || s['store.legalName'],
        accountNumber: s['payments.bankAccountNumber'],
        ifsc: s['payments.bankIfsc'],
      },
    };
  }

  /** Customer reports the UTR of their transfer so an admin can match it. */
  async submitReference(customerId: string, orderId: string, dto: SubmitPaymentReferenceDto) {
    const payment = await this.manualPayment(customerId, orderId);
    if (payment.order.status !== OrderStatus.PENDING_PAYMENT || payment.status !== 'PENDING') {
      throw new BadRequestException('This order is not awaiting payment');
    }
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: dto.reference.toUpperCase(),
        raw: { submittedAt: new Date().toISOString() },
      },
    });
    return this.instructions(customerId, orderId);
  }

  /** Admin has seen the money arrive: capture the payment and mark the order paid. */
  async adminConfirm(paymentId: string) {
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (!MANUAL_PROVIDERS.includes(payment.provider) || payment.status !== 'PENDING') {
        throw new BadRequestException('Only pending UPI / bank transfer payments can be confirmed');
      }
      if (payment.order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException(`Order is ${payment.order.status.toLowerCase()}, not awaiting payment`);
      }
      await tx.payment.update({ where: { id: payment.id }, data: { status: 'CAPTURED' } });
      await this.orders.markPaid(tx, payment.orderId);
    });
    return { confirmed: true };
  }

  /** Admin could not find the transfer; the customer can submit a corrected UTR. */
  async adminReject(paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || !MANUAL_PROVIDERS.includes(payment.provider) || payment.status !== 'PENDING') {
      throw new BadRequestException('Only pending UPI / bank transfer payments can be rejected');
    }
    await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        providerPaymentId: null,
        raw: { rejectedAt: new Date().toISOString(), reason: reason ?? null },
      },
    });
    return { rejected: true };
  }

  private async manualPayment(customerId: string, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { customerId }, provider: { in: MANUAL_PROVIDERS } },
      include: { order: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('No UPI / bank transfer payment for this order');
    return payment;
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
        include: { order: { select: { id: true, orderNumber: true, customerId: true } } },
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

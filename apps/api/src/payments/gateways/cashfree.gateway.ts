import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import {
  CreateGatewayOrderInput,
  CreateGatewayOrderResult,
  GatewayPaymentEvent,
  header,
  PaymentGateway,
} from './payment-gateway';
import { hmacSha256, safeEqual } from './signature';

const API_VERSION = '2023-08-01';

/** Cashfree Payment Gateway (PG v3 orders API). */
@Injectable()
export class CashfreeGateway implements PaymentGateway {
  readonly provider = PaymentProvider.CASHFREE;
  private readonly appId: string;
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.appId = config.get<string>('payments.cashfree.appId')!;
    this.secretKey = config.get<string>('payments.cashfree.secretKey')!;
    this.baseUrl =
      config.get<string>('payments.cashfree.env') === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg';
  }

  isConfigured() {
    return Boolean(this.appId && this.secretKey);
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'x-client-id': this.appId,
      'x-client-secret': this.secretKey,
      'x-api-version': API_VERSION,
    };
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult> {
    // Cashfree order ids must be unique per attempt, so suffix our order number.
    const cfOrderId = `${input.orderNumber}-${Date.now().toString(36)}`;
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        order_id: cfOrderId,
        order_amount: input.amount / 100,
        order_currency: input.currency,
        customer_details: {
          customer_id: input.customer.id,
          customer_email: input.customer.email,
          customer_phone: input.customer.phone,
          customer_name: input.customer.name,
        },
        order_tags: { orderId: input.orderId },
        ...(input.preferredMethod === 'upi' && { order_meta: { payment_methods: 'upi' } }),
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`Cashfree order creation failed (${res.status})`);
    }
    const order = (await res.json()) as { order_id: string; payment_session_id: string };
    return {
      providerOrderId: order.order_id,
      clientPayload: { paymentSessionId: order.payment_session_id, orderId: order.order_id },
    };
  }

  /** Cashfree's client callback is unsigned, so we confirm status with the API. */
  async verifyClientPayment(providerOrderId: string) {
    const res = await fetch(`${this.baseUrl}/orders/${encodeURIComponent(providerOrderId)}`, {
      headers: this.headers(),
    });
    if (!res.ok) return null;
    const order = (await res.json()) as { order_status: string };
    if (order.order_status !== 'PAID') return null;
    return { providerOrderId, status: 'CAPTURED' as const, raw: order };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    const timestamp = header(headers, 'x-webhook-timestamp');
    if (!timestamp) return null;
    const expected = hmacSha256(this.secretKey, timestamp + rawBody.toString('utf8'), 'base64');
    if (!safeEqual(header(headers, 'x-webhook-signature'), expected)) return null;

    const body = JSON.parse(rawBody.toString('utf8'));
    const orderId = body?.data?.order?.order_id;
    const payment = body?.data?.payment;
    if (!orderId || !payment) return null;
    const status: GatewayPaymentEvent['status'] | undefined =
      payment.payment_status === 'SUCCESS'
        ? 'CAPTURED'
        : payment.payment_status === 'FAILED'
          ? 'FAILED'
          : undefined;
    if (!status) return null;
    return {
      providerOrderId: orderId,
      providerPaymentId: String(payment.cf_payment_id),
      method: payment.payment_group,
      status,
      raw: body,
    };
  }
}

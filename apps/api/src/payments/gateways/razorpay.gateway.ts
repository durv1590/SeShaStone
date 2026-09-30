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

const API = 'https://api.razorpay.com/v1';

/** Razorpay Standard Checkout — cards, netbanking, wallets and UPI. */
@Injectable()
export class RazorpayGateway implements PaymentGateway {
  readonly provider = PaymentProvider.RAZORPAY;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.keyId = config.get<string>('payments.razorpay.keyId')!;
    this.keySecret = config.get<string>('payments.razorpay.keySecret')!;
    this.webhookSecret = config.get<string>('payments.razorpay.webhookSecret')!;
  }

  isConfigured() {
    return Boolean(this.keyId && this.keySecret);
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult> {
    const res = await fetch(`${API}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: input.amount,
        currency: input.currency,
        receipt: input.orderNumber,
        notes: { orderId: input.orderId },
      }),
    });
    if (!res.ok) {
      throw new ServiceUnavailableException(`Razorpay order creation failed (${res.status})`);
    }
    const order = (await res.json()) as { id: string };
    return {
      providerOrderId: order.id,
      clientPayload: {
        key: this.keyId,
        order_id: order.id,
        amount: input.amount,
        currency: input.currency,
        name: 'Se Sha Stone',
        description: `Order ${input.orderNumber}`,
        prefill: { name: input.customer.name, email: input.customer.email, contact: input.customer.phone },
        ...(input.preferredMethod === 'upi' && {
          config: { display: { preferences: { show_default_blocks: true }, sequence: ['block.upi'] } },
        }),
      },
    };
  }

  async verifyClientPayment(providerOrderId: string, payload: Record<string, string>) {
    const { razorpay_payment_id: paymentId, razorpay_signature: signature } = payload;
    if (!paymentId) return null;
    const expected = hmacSha256(this.keySecret, `${providerOrderId}|${paymentId}`, 'hex');
    if (!safeEqual(signature, expected)) return null;
    return {
      providerOrderId,
      providerPaymentId: paymentId,
      status: 'CAPTURED' as const,
      raw: payload,
    };
  }

  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>) {
    if (!this.webhookSecret) return null;
    const expected = hmacSha256(this.webhookSecret, rawBody, 'hex');
    if (!safeEqual(header(headers, 'x-razorpay-signature'), expected)) return null;

    const body = JSON.parse(rawBody.toString('utf8'));
    const payment = body?.payload?.payment?.entity;
    if (!payment?.order_id) return null;
    const statusByEvent: Record<string, GatewayPaymentEvent['status']> = {
      'payment.captured': 'CAPTURED',
      'order.paid': 'CAPTURED',
      'payment.failed': 'FAILED',
    };
    const status = statusByEvent[body.event];
    if (!status) return null;
    return {
      providerOrderId: payment.order_id,
      providerPaymentId: payment.id,
      method: payment.method,
      status,
      raw: body,
    };
  }
}

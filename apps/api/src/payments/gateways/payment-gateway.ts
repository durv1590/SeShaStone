import { PaymentProvider } from '@prisma/client';

export interface CreateGatewayOrderInput {
  /** Our internal order id — used as receipt/reference at the gateway. */
  orderId: string;
  orderNumber: string;
  amount: number; // paise
  currency: string;
  customer: { id: string; email: string; phone: string; name: string };
  /** Pre-select a payment method in the gateway checkout, e.g. 'upi'. */
  preferredMethod?: 'upi';
}

export interface CreateGatewayOrderResult {
  providerOrderId: string;
  /** Data the storefront needs to open the gateway's checkout widget. */
  clientPayload: Record<string, unknown>;
}

export interface GatewayPaymentEvent {
  providerOrderId: string;
  providerPaymentId?: string;
  status: 'CAPTURED' | 'FAILED';
  method?: string;
  raw: unknown;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  isConfigured(): boolean;
  createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderResult>;
  /** Verifies the client-side success callback. Returns null if it cannot be trusted. */
  verifyClientPayment(
    providerOrderId: string,
    payload: Record<string, string>,
  ): Promise<GatewayPaymentEvent | null>;
  /** Verifies a server-to-server webhook. Returns null for invalid or irrelevant events. */
  parseWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): GatewayPaymentEvent | null;
}

export function header(headers: Record<string, string | string[] | undefined>, name: string) {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

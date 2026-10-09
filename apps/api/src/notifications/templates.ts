import { formatInr } from '../common/utils/money';

export interface OrderContext {
  orderNumber: string;
  total: number;
  customerName?: string | null;
  trackingNumber?: string | null;
  courier?: string | null;
  reason?: string | null;
  amount?: number;
  link?: string;
}

type Template = (ctx: OrderContext) => { subject: string; text: string };

const sign = '\n\n— SeSha Stone\nTimeless Elegance';
const hi = (ctx: OrderContext) => `Dear ${ctx.customerName || 'Customer'},\n\n`;

/** Plain-text transactional emails. Never include bank/UPI details or secrets here. */
export const TEMPLATES: Record<string, Template> = {
  'order.placed': (c) => ({
    subject: `Order ${c.orderNumber} received`,
    text: `${hi(c)}Thank you for your order ${c.orderNumber} (${formatInr(c.total)}).\n\nIf you chose UPI or bank transfer, please complete the payment using the details on your order page and submit the UTR. Your order will be processed after the payment is verified.${sign}`,
  }),
  'payment.submitted': (c) => ({
    subject: `Payment submitted for order ${c.orderNumber}`,
    text: `${hi(c)}We have received your payment details for order ${c.orderNumber}. Your payment has been submitted for verification. Your order will be processed after successful payment verification.${sign}`,
  }),
  'payment.verified': (c) => ({
    subject: `Payment verified — order ${c.orderNumber} confirmed`,
    text: `${hi(c)}Your payment of ${formatInr(c.total)} for order ${c.orderNumber} has been verified. We are now preparing your order.${sign}`,
  }),
  'payment.rejected': (c) => ({
    subject: `Action needed: payment for order ${c.orderNumber}`,
    text: `${hi(c)}We could not match your payment reference for order ${c.orderNumber} with our bank statement.${c.reason ? `\n\nNote from our team: ${c.reason}` : ''}\n\nPlease check the UTR / transaction ID and submit it again from your order page.${sign}`,
  }),
  'order.shipped': (c) => ({
    subject: `Order ${c.orderNumber} has shipped`,
    text: `${hi(c)}Good news — order ${c.orderNumber} is on its way.${c.trackingNumber ? `\n\nTracking number: ${c.trackingNumber}${c.courier ? ` (${c.courier})` : ''}` : ''}${sign}`,
  }),
  'order.delivered': (c) => ({
    subject: `Order ${c.orderNumber} delivered`,
    text: `${hi(c)}Order ${c.orderNumber} has been delivered. We hope you love it.${sign}`,
  }),
  'order.cancelled': (c) => ({
    subject: `Order ${c.orderNumber} cancelled`,
    text: `${hi(c)}Order ${c.orderNumber} has been cancelled.${c.reason ? ` Reason: ${c.reason}` : ''}${sign}`,
  }),
  'refund.processed': (c) => ({
    subject: `Refund processed for order ${c.orderNumber}`,
    text: `${hi(c)}A refund of ${formatInr(c.amount ?? 0)} for order ${c.orderNumber} has been processed.${sign}`,
  }),
  'auth.password_reset': (c) => ({
    subject: 'Reset your SeSha Stone password',
    text: `${hi(c)}Use this link to reset your password. It expires in 30 minutes:\n\n${c.link}\n\nIf you did not request this, you can ignore this email.${sign}`,
  }),
};

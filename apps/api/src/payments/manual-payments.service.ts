import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentProvider } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { Actor } from '../common/decorators/actor.decorator';
import { sniffFileType, toBytes } from '../common/utils/file-type';
import { NotificationsService } from '../notifications/notifications.service';
import { MANUAL_PROVIDERS } from '../orders/order-lifecycle';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
const EVIDENCE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const EVIDENCE_MAX_FILES = 3;

export const SUBMITTED_MESSAGE =
  'Your payment has been submitted for verification. Your order will be processed after successful payment verification.';

/**
 * Direct UPI and bank-transfer payments. Nothing here ever marks a payment as paid on the
 * customer's word: a UTR or uploaded screenshot only moves it to SUBMITTED, and an authorised
 * staff member must verify it against the actual bank / UPI statement.
 */
@Injectable()
export class ManualPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Payment details for the customer's own order only. The original QR image is shown when it is
   * present and verified to pay the configured UPI ID; a generated amount-prefilled QR / intent
   * link is offered only if an admin has explicitly enabled it.
   */
  async instructions(customerId: string, orderId: string) {
    const payment = await this.manualPayment(customerId, orderId);
    const order = payment.order;
    const s = await this.settings.all();
    const base = {
      provider: payment.provider,
      paymentId: payment.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: payment.status,
      amount: order.total,
      reference: order.orderNumber,
      submittedReference: payment.providerPaymentId,
      submittedAt: payment.submittedAt,
      rejectionReason: payment.status === 'PENDING' ? payment.rejectionReason : null,
      evidence: payment.evidence,
      message: payment.status === 'SUBMITTED' ? SUBMITTED_MESSAGE : null,
    };

    if (payment.provider === PaymentProvider.UPI_DIRECT) {
      const qr = await this.settings.upiQr();
      const verifiedQr = qr.present && qr.matchesUpiId;
      const upiId = String(s['payments.upiId']);
      const payeeName = String(s['payments.upiPayeeName'] || qr.decoded?.payeeName || s['store.legalName']);
      const intentUri = s['payments.upiGeneratedQrEnabled']
        ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${(order.total / 100).toFixed(2)}&cu=INR` +
          `&tn=${encodeURIComponent(`Order ${order.orderNumber}`)}`
        : null;
      return {
        ...base,
        upi: {
          upiId,
          payeeName,
          qrImage: verifiedQr ? qr.dataUrl : null,
          intentUri,
          instructions: s['payments.upiInstructions'] || null,
        },
      };
    }
    return {
      ...base,
      bank: {
        bankName: s['payments.bankName'],
        accountName: s['payments.bankAccountName'] || s['store.legalName'],
        accountNumber: s['payments.bankAccountNumber'],
        ifsc: s['payments.bankIfsc'],
        branch: s['payments.bankBranch'] || null,
        instructions: s['payments.bankInstructions'] || null,
      },
    };
  }

  /** Customer reports the UTR of their transfer so staff can match it. */
  async submitReference(customerId: string, orderId: string, reference: string) {
    const payment = await this.manualPayment(customerId, orderId);
    this.assertAwaitingPayment(payment);
    const utr = reference.toUpperCase();
    const reused = await this.prisma.payment.findFirst({
      where: { providerPaymentId: utr, id: { not: payment.id }, provider: { in: MANUAL_PROVIDERS }, status: { in: ['SUBMITTED', 'CAPTURED'] } },
      select: { id: true },
    });
    if (reused) throw new BadRequestException('This transaction reference has already been used for another order');

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: utr, status: 'SUBMITTED', submittedAt: new Date(), rejectionReason: null },
    });
    await this.audit.record({ id: customerId }, {
      action: 'payment.submitted',
      entityType: 'Order',
      entityId: orderId,
      after: { paymentId: payment.id, reference: utr },
    });
    if (payment.status === 'PENDING') this.notifySubmitted(payment.order);
    return this.instructions(customerId, orderId);
  }

  /** Optional supporting screenshot / PDF. Validated by content, stored privately. */
  async uploadEvidence(customerId: string, orderId: string, file?: { buffer: Buffer; size: number; originalname: string }) {
    const payment = await this.manualPayment(customerId, orderId);
    this.assertAwaitingPayment(payment);
    if (!file?.buffer?.length) throw new BadRequestException('Choose a file to upload');
    if (file.size > EVIDENCE_MAX_BYTES) throw new BadRequestException('File must be 5 MB or smaller');
    const mimeType = sniffFileType(file.buffer);
    if (!mimeType || !EVIDENCE_TYPES.includes(mimeType)) {
      throw new BadRequestException('Upload a PNG, JPEG, WebP image or a PDF');
    }
    if (payment.evidence.length >= EVIDENCE_MAX_FILES) {
      throw new BadRequestException(`You can upload up to ${EVIDENCE_MAX_FILES} files per payment`);
    }
    const safeName = (file.originalname || 'payment-proof').replace(/[^\w.\- ]+/g, '_').slice(0, 100);
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentEvidence.create({
        data: {
          paymentId: payment.id,
          fileName: safeName,
          mimeType,
          size: file.size,
          sha256: createHash('sha256').update(file.buffer).digest('hex'),
          data: toBytes(file.buffer),
        },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUBMITTED', submittedAt: payment.submittedAt ?? new Date(), rejectionReason: null },
      });
    });
    await this.audit.record({ id: customerId }, { action: 'payment.evidence_uploaded', entityType: 'Order', entityId: orderId, after: { fileName: safeName, mimeType } });
    if (payment.status === 'PENDING') this.notifySubmitted(payment.order);
    return this.instructions(customerId, orderId);
  }

  /** Streams one evidence file to its owner, or to staff when customerId is null. */
  async evidenceFile(evidenceId: string, customerId: string | null) {
    const file = await this.prisma.paymentEvidence.findFirst({
      where: { id: evidenceId, ...(customerId && { payment: { order: { customerId } } }) },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  /** Staff confirmed the money arrived: capture the payment and mark the order paid. */
  async verify(actor: Actor, paymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { customer: true } } } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (!MANUAL_PROVIDERS.includes(payment.provider) || !['PENDING', 'SUBMITTED'].includes(payment.status)) {
        throw new BadRequestException('Only pending UPI / bank transfer payments can be verified');
      }
      if (payment.order.status !== OrderStatus.PENDING_PAYMENT) {
        throw new BadRequestException(`Order is ${payment.order.status.toLowerCase().replace(/_/g, ' ')}, not awaiting payment`);
      }
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'CAPTURED', verifiedAt: new Date(), verifiedById: actor.id, rejectionReason: null },
      });
      await this.orders.markPaid(tx, payment.orderId);
      await this.audit.record(actor, {
        action: 'payment.verify',
        entityType: 'Order',
        entityId: payment.orderId,
        before: { paymentStatus: payment.status },
        after: { paymentStatus: 'CAPTURED', reference: payment.providerPaymentId, amount: payment.amount },
      }, tx);
      return payment;
    });
    this.notifications.notify({
      template: 'payment.verified',
      to: result.order.customerEmail ?? result.order.customer.email,
      orderId: result.orderId,
      customerId: result.order.customerId,
      context: { orderNumber: result.order.orderNumber, total: result.order.total, customerName: result.order.customer.firstName },
    });
    return { verified: true };
  }

  /** Staff could not find the transfer; the customer is asked to resubmit. */
  async reject(actor: Actor, paymentId: string, reason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: { include: { customer: true } } } });
    if (!payment || !MANUAL_PROVIDERS.includes(payment.provider) || !['PENDING', 'SUBMITTED'].includes(payment.status)) {
      throw new BadRequestException('Only pending UPI / bank transfer payments can be rejected');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: 'PENDING', providerPaymentId: null, rejectionReason: reason, submittedAt: null },
      });
      await this.audit.record(actor, {
        action: 'payment.reject',
        entityType: 'Order',
        entityId: payment.orderId,
        before: { paymentStatus: payment.status, reference: payment.providerPaymentId },
        after: { paymentStatus: 'PENDING', reason },
      }, tx);
    });
    this.notifications.notify({
      template: 'payment.rejected',
      to: payment.order.customerEmail ?? payment.order.customer.email,
      orderId: payment.orderId,
      customerId: payment.order.customerId,
      context: { orderNumber: payment.order.orderNumber, total: payment.order.total, customerName: payment.order.customer.firstName, reason },
    });
    return { rejected: true };
  }

  private assertAwaitingPayment(payment: { status: string; order: { status: OrderStatus } }) {
    if (payment.order.status !== OrderStatus.PENDING_PAYMENT || !['PENDING', 'SUBMITTED'].includes(payment.status)) {
      throw new BadRequestException('This order is not awaiting payment');
    }
  }

  private notifySubmitted(order: { id: string; orderNumber: string; total: number; customerId: string; customerEmail: string | null }) {
    this.notifications.notify({
      template: 'payment.submitted',
      to: order.customerEmail,
      orderId: order.id,
      customerId: order.customerId,
      context: { orderNumber: order.orderNumber, total: order.total },
    });
  }

  private async manualPayment(customerId: string, orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, order: { customerId }, provider: { in: MANUAL_PROVIDERS } },
      include: {
        order: true,
        evidence: { select: { id: true, fileName: true, mimeType: true, size: true, uploadedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('No UPI / bank transfer payment for this order');
    return payment;
  }
}

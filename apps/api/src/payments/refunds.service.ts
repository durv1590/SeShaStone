import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { Actor } from '../common/decorators/actor.decorator';
import { paginated } from '../common/dto/pagination.dto';
import { formatInr } from '../common/utils/money';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRefundDto, ListRefundsDto, UpdateRefundDto } from './payments.dto';

type Tx = Prisma.TransactionClient;

/** Amount (paise) still refundable: captured payments minus refunds that are pending or processed. */
export function refundableAmount(
  payments: { status: string; amount: number }[],
  refunds: { status: string; amount: number }[],
) {
  const received = payments
    .filter((p) => ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status))
    .reduce((n, p) => n + p.amount, 0);
  const committed = refunds.filter((r) => r.status !== 'FAILED').reduce((n, r) => n + r.amount, 0);
  return Math.max(0, received - committed);
}

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(query: ListRefundsDto) {
    const where: Prisma.RefundWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: { order: { select: { id: true, orderNumber: true, status: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async create(actor: Actor, orderId: string, dto: CreateRefundDto) {
    const refund = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { payments: true, refunds: true } });
      if (!order) throw new NotFoundException('Order not found');
      const available = refundableAmount(order.payments, order.refunds);
      if (available <= 0) throw new BadRequestException('No verified payment is available to refund on this order');
      if (dto.amount > available) {
        throw new BadRequestException(`At most ${formatInr(available)} can be refunded on this order`);
      }
      if (dto.processed && !dto.reference) throw new BadRequestException('Enter the refund transfer reference (UTR)');
      const payment = order.payments.find((p) => ['CAPTURED', 'PARTIALLY_REFUNDED'].includes(p.status));

      const created = await tx.refund.create({
        data: {
          orderId,
          paymentId: payment?.id,
          amount: dto.amount,
          reason: dto.reason,
          method: dto.method,
          reference: dto.reference,
          createdById: actor.id,
          status: 'PENDING',
        },
      });
      await this.audit.record(actor, { action: 'refund.create', entityType: 'Order', entityId: orderId, after: { refundId: created.id, amount: dto.amount, reason: dto.reason } }, tx);
      if (dto.processed) await this.markProcessed(tx, actor, created.id, dto.reference);
      return tx.refund.findUniqueOrThrow({ where: { id: created.id } });
    });
    if (refund.status === 'PROCESSED') this.notifyProcessed(refund.id);
    return refund;
  }

  async update(actor: Actor, refundId: string, dto: UpdateRefundDto) {
    const refund = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.refund.findUnique({ where: { id: refundId } });
      if (!existing) throw new NotFoundException('Refund not found');
      if (existing.status !== 'PENDING') throw new BadRequestException('Only pending refunds can be updated');
      if (dto.status === 'PROCESSED') {
        if (!dto.reference && !existing.reference) throw new BadRequestException('Enter the refund transfer reference (UTR)');
        await this.markProcessed(tx, actor, refundId, dto.reference ?? existing.reference!, dto.notes);
      } else {
        await tx.refund.update({ where: { id: refundId }, data: { status: 'FAILED', notes: dto.notes } });
        await this.audit.record(actor, { action: 'refund.failed', entityType: 'Order', entityId: existing.orderId, after: { refundId, notes: dto.notes } }, tx);
      }
      return tx.refund.findUniqueOrThrow({ where: { id: refundId } });
    });
    if (refund.status === 'PROCESSED') this.notifyProcessed(refund.id);
    return refund;
  }

  /** Records the payout, updates the payment's refunded total and, when fully refunded, the order. */
  private async markProcessed(tx: Tx, actor: Actor, refundId: string, reference?: string, notes?: string) {
    const refund = await tx.refund.update({
      where: { id: refundId },
      data: { status: 'PROCESSED', processedAt: new Date(), reference, ...(notes && { notes }) },
    });
    if (refund.paymentId) {
      const payment = await tx.payment.update({
        where: { id: refund.paymentId },
        data: { refundedAmount: { increment: refund.amount } },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: payment.refundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
      });
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: refund.orderId }, include: { payments: true } });
    const received = order.payments.filter((p) => ['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status)).reduce((n, p) => n + p.amount, 0);
    const refunded = order.payments.reduce((n, p) => n + p.refundedAmount, 0);
    const fullyRefunded = received > 0 && refunded >= received;
    // Only close orders that are not still being fulfilled (cancelled, returned, or never shipped).
    if (fullyRefunded && ['CANCELLED', 'RETURNED', 'PAID', 'PROCESSING', 'PACKED', 'DELIVERED', 'RETURN_REQUESTED'].includes(order.status)) {
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.REFUNDED } });
    }
    await this.audit.record(actor, {
      action: 'refund.processed',
      entityType: 'Order',
      entityId: refund.orderId,
      after: { refundId, amount: refund.amount, reference, orderRefunded: fullyRefunded },
    }, tx);
  }

  private async notifyProcessed(refundId: string) {
    const refund = await this.prisma.refund.findUnique({ where: { id: refundId }, include: { order: { include: { customer: true } } } });
    if (!refund) return;
    this.notifications.notify({
      template: 'refund.processed',
      to: refund.order.customerEmail ?? refund.order.customer.email,
      orderId: refund.orderId,
      customerId: refund.order.customerId,
      context: { orderNumber: refund.order.orderNumber, total: refund.order.total, amount: refund.amount, customerName: refund.order.customer.firstName },
    });
  }
}

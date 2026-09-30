import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Address, OrderStatus, PaymentProvider, Prisma } from '@prisma/client';
import { AddressesService } from '../addresses/addresses.service';
import { AuditService } from '../audit/audit.service';
import { Actor } from '../common/decorators/actor.decorator';
import { paginated, PaginationDto } from '../common/dto/pagination.dto';
import { generateOrderNumber } from '../common/utils/order-number';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService, StockLine } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  canTransition,
  MANUAL_PROVIDERS,
  PAID_STATUSES,
  priceLines,
  shippingFor,
  STOCK_COMMITTED_STATUSES,
  toStockLines,
} from './order-lifecycle';
import { CheckoutDto, CheckoutItemDto, ListOrdersDto, UpdateOrderStatusDto } from './orders.dto';

export { MANUAL_PROVIDERS } from './order-lifecycle';

type Tx = Prisma.TransactionClient;

const paymentPublic = {
  id: true,
  provider: true,
  status: true,
  amount: true,
  method: true,
  providerPaymentId: true,
  submittedAt: true,
  verifiedAt: true,
  rejectionReason: true,
  refundedAmount: true,
  createdAt: true,
  evidence: { select: { id: true, fileName: true, mimeType: true, size: true, uploadedAt: true } },
} satisfies Prisma.PaymentSelect;

const customerOrderInclude = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' }, select: paymentPublic },
  refunds: {
    where: { status: { not: 'FAILED' } },
    select: { id: true, amount: true, status: true, reference: true, processedAt: true, createdAt: true },
  },
  returnRequests: { select: { id: true, reason: true, status: true, adminNote: true, createdAt: true } },
} satisfies Prisma.OrderInclude;

function addressSnapshot(a: Address) {
  return {
    fullName: a.fullName,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    country: a.country,
  };
}

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly addresses: AddressesService,
    private readonly coupons: CouponsService,
    private readonly inventory: InventoryService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Release stock held by abandoned checkouts every 5 minutes.
    this.expiryTimer = setInterval(() => {
      this.expireStalePendingOrders().catch((err) => this.logger.warn(`Pending order expiry failed: ${err.message}`));
    }, 5 * 60_000);
    this.expiryTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.expiryTimer);
  }

  /** Prices a cart without creating anything — used by the cart/checkout page. */
  async quote(customerId: string, items: CheckoutItemDto[], couponCode?: string) {
    return this.price(this.prisma, customerId, items, couponCode);
  }

  async checkout(customerId: string, dto: CheckoutDto) {
    // Duplicate submission (double-click, retry after timeout): return the order already created.
    if (dto.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(customerId, dto.idempotencyKey);
      if (existing) return existing;
    }

    const address = await this.addresses.findOwned(customerId, dto.addressId);
    const billing =
      dto.billingAddressId && dto.billingAddressId !== dto.addressId
        ? await this.addresses.findOwned(customerId, dto.billingAddressId)
        : null;
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id: customerId } });

    const settings = await this.settings.all();
    const isCod = dto.paymentProvider === PaymentProvider.COD;
    const isManual = MANUAL_PROVIDERS.includes(dto.paymentProvider);
    const enabled = settings['payments.enabledProviders'];
    if (isCod ? !settings['checkout.codEnabled'] : !enabled.includes(dto.paymentProvider)) {
      throw new BadRequestException('Selected payment method is not available');
    }
    if (isManual && !(await this.manualProviderConfigured(dto.paymentProvider))) {
      throw new BadRequestException('Selected payment method is not set up yet');
    }

    let order;
    try {
      order = await this.prisma.$transaction(async (tx) => {
        // Prices and availability are always recalculated here — client prices are never trusted.
        const { coupon, ...totals } = await this.price(tx, customerId, dto.items, dto.couponCode);

        const created = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            customerId,
            status: isCod ? OrderStatus.PROCESSING : OrderStatus.PENDING_PAYMENT,
            subtotal: totals.subtotal,
            discount: totals.discount,
            shipping: totals.shipping,
            tax: totals.tax,
            total: totals.total,
            couponCode: coupon?.code,
            notes: dto.notes,
            shippingAddress: addressSnapshot(address),
            billingAddress: billing ? addressSnapshot(billing) : undefined,
            customerEmail: customer.email,
            customerPhone: address.phone,
            idempotencyKey: dto.idempotencyKey,
            items: { create: totals.lines },
          },
        });

        const stock = toStockLines(dto.items);
        await this.inventory.reserve(tx, stock, created.id);
        if (coupon) await this.coupons.redeem(tx, coupon, customerId, created.id);

        if (isCod) {
          await this.inventory.commit(tx, stock, created.id);
          await tx.payment.create({
            data: { orderId: created.id, provider: 'COD', status: 'PENDING', amount: created.total },
          });
        } else if (isManual) {
          // Awaiting the customer's transfer; an admin verifies it against the bank statement.
          await tx.payment.create({
            data: {
              orderId: created.id,
              provider: dto.paymentProvider,
              status: 'PENDING',
              amount: created.total,
              method: dto.paymentProvider === PaymentProvider.UPI_DIRECT ? 'upi' : 'bank_transfer',
            },
          });
        }
        return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: customerOrderInclude });
      });
    } catch (err) {
      // Two concurrent submissions with the same key: the loser returns the winner's order.
      if (dto.idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.findByIdempotencyKey(customerId, dto.idempotencyKey);
        if (existing) return existing;
      }
      throw err;
    }

    this.notifications.notify({
      template: 'order.placed',
      to: customer.email,
      customerId,
      orderId: order.id,
      context: { orderNumber: order.orderNumber, total: order.total, customerName: customer.firstName },
    });
    return order;
  }

  async listMine(customerId: string, query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = { customerId, ...(query.status && { status: query.status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true, payments: { select: { provider: true, status: true } } },
        orderBy: { placedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async findMine(customerId: string, id: string) {
    const order = await this.prisma.order.findFirst({ where: { id, customerId }, include: customerOrderInclude });
    if (!order) throw new NotFoundException('Order not found');
    const windowDays = await this.settings.get('returns.windowDays');
    return { ...order, returnEligibleUntil: this.returnDeadline(order.deliveredAt, windowDays) };
  }

  async cancelMine(customerId: string, id: string) {
    const order = await this.findMine(customerId, id);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Only unpaid orders can be cancelled online; please contact support');
    }
    await this.transition(null, id, { status: OrderStatus.CANCELLED, reason: 'Cancelled by customer' });
    return this.findMine(customerId, id);
  }

  /** Customer asks to return a delivered order within the return window. */
  async requestReturn(customerId: string, id: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId },
      include: { items: { include: { variant: { select: { product: { select: { name: true, isReturnEligible: true } } } } } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.DELIVERED) throw new BadRequestException('Only delivered orders can be returned');
    const deadline = this.returnDeadline(order.deliveredAt, await this.settings.get('returns.windowDays'));
    if (!deadline || deadline < new Date()) throw new BadRequestException('The return window for this order has closed');
    const ineligible = order.items.filter((i) => !i.variant.product.isReturnEligible).map((i) => i.variant.product.name);
    if (ineligible.length) throw new BadRequestException(`Not eligible for return: ${ineligible.join(', ')}`);

    await this.prisma.$transaction(async (tx) => {
      await tx.returnRequest.create({ data: { orderId: id, customerId, reason } });
      await tx.order.update({ where: { id }, data: { status: OrderStatus.RETURN_REQUESTED } });
      await this.audit.record({ id: customerId }, { action: 'order.return_requested', entityType: 'Order', entityId: id, after: { reason } }, tx);
    });
    return this.findMine(customerId, id);
  }

  /** Public order tracking by order number + email. Returns no personal or payment details. */
  async track(orderNumber: string, email: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderNumber.trim().toUpperCase() },
      include: { customer: { select: { email: true } }, _count: { select: { items: true } } },
    });
    const matches =
      order && [order.customerEmail, order.customer.email].some((e) => e?.toLowerCase() === email.trim().toLowerCase());
    if (!order || !matches) throw new NotFoundException('No order found with that order number and email');
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      trackingNumber: order.trackingNumber,
      courier: order.courier,
      itemCount: order._count.items,
    };
  }

  // ── Admin ──────────────────────────────────────────────────

  async adminList(query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { orderNumber: { contains: query.q, mode: 'insensitive' } },
          { customer: { email: { contains: query.q, mode: 'insensitive' } } },
          { customerPhone: { contains: query.q } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
          payments: { select: { provider: true, status: true } },
          _count: { select: { items: true } },
        },
        orderBy: { placedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async adminGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        ...customerOrderInclude,
        refunds: { orderBy: { createdAt: 'desc' } },
        returnRequests: { orderBy: { createdAt: 'desc' } },
        customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const [notifications, history] = await Promise.all([
      this.notifications.forOrder(id),
      this.audit.list(Object.assign(new PaginationDto(), { pageSize: 50, entityType: 'Order', entityId: id })),
    ]);
    return { ...order, notifications, history: history.items };
  }

  adminUpdateStatus(actor: Actor, id: string, dto: UpdateOrderStatusDto) {
    return this.transition(actor, id, dto);
  }

  async stats() {
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const [revenue, totalOrders, byStatus, customers, products, pendingPayments, submittedPayments, verified, pendingRefunds, activeBanners, lowStock] =
      await Promise.all([
        this.prisma.order.aggregate({
          where: { status: { in: PAID_STATUSES }, placedAt: { gte: since } },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.order.count(),
        this.prisma.order.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
        this.prisma.customer.count({ where: { role: 'CUSTOMER' } }),
        this.prisma.product.count({ where: { status: 'ACTIVE' } }),
        this.prisma.payment.count({ where: { status: 'PENDING', order: { status: 'PENDING_PAYMENT' } } }),
        this.prisma.payment.count({ where: { status: 'SUBMITTED' } }),
        this.prisma.payment.count({ where: { status: 'CAPTURED', verifiedAt: { gte: since } } }),
        this.prisma.refund.count({ where: { status: 'PENDING' } }),
        this.prisma.banner.count({ where: { isActive: true, OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] } }),
        this.prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint AS count FROM "InventoryItem" WHERE quantity - reserved <= "lowStockThreshold"`,
      ]);
    const byStatusMap = Object.fromEntries(byStatus.map((s) => [s.status, (s._count as { _all: number })._all]));
    return {
      last30Days: { revenue: revenue._sum.total ?? 0, paidOrders: revenue._count, verifiedPayments: verified },
      totals: {
        orders: totalOrders,
        customers,
        activeProducts: products,
        pendingOrders: ['PAID', 'PROCESSING', 'PACKED'].reduce((n, s) => n + (byStatusMap[s] ?? 0), 0),
        awaitingPayment: pendingPayments,
        paymentsToVerify: submittedPayments,
        pendingRefunds,
        returnRequests: byStatusMap.RETURN_REQUESTED ?? 0,
        lowStock: Number(lowStock[0]?.count ?? 0),
        activeCampaigns: activeBanners,
      },
      ordersByStatus: byStatusMap,
    };
  }

  // ── Payment callbacks (used by PaymentsService) ────────────

  /** Marks an order paid and converts its stock reservation into a sale. Idempotent. */
  async markPaid(tx: Tx, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    if (order.status !== OrderStatus.PENDING_PAYMENT) return order;
    await this.inventory.commit(tx, toStockLines(order.items), order.id);
    return tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.PAID } });
  }

  // ── Internals ──────────────────────────────────────────────

  private async transition(
    actor: Actor | null,
    id: string,
    change: { status: OrderStatus; trackingNumber?: string; courier?: string; reason?: string },
    paymentOutcome: 'FAILED' | 'EXPIRED' = 'FAILED',
  ) {
    const next = change.status;
    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true, customer: { select: { email: true, firstName: true } } } });
      if (!order) throw new NotFoundException('Order not found');
      if (!canTransition(order.status, next)) {
        throw new BadRequestException(`Cannot move order from ${order.status} to ${next}`);
      }
      const stock = toStockLines(order.items);

      if (next === OrderStatus.CANCELLED) {
        if (order.status === OrderStatus.PENDING_PAYMENT) {
          await this.inventory.release(tx, stock, order.id);
        } else if (STOCK_COMMITTED_STATUSES.includes(order.status)) {
          await this.restock(tx, stock, order.id, 'Order cancelled');
        }
        await tx.payment.updateMany({
          where: { orderId: order.id, status: { in: ['CREATED', 'PENDING', 'SUBMITTED'] } },
          data: { status: paymentOutcome },
        });
        await this.releaseCoupon(tx, order.id);
      }
      if (next === OrderStatus.DELIVERED && order.status !== OrderStatus.RETURN_REQUESTED) {
        // Cash on delivery is collected by the courier at handover.
        await tx.payment.updateMany({
          where: { orderId: order.id, provider: 'COD', status: 'PENDING' },
          data: { status: 'CAPTURED', verifiedAt: new Date() },
        });
      }
      if (order.status === OrderStatus.RETURN_REQUESTED) {
        const request = await tx.returnRequest.findFirst({ where: { orderId: id, status: 'REQUESTED' }, orderBy: { createdAt: 'desc' } });
        if (request) {
          await tx.returnRequest.update({
            where: { id: request.id },
            data: { status: next === OrderStatus.RETURNED ? 'RECEIVED' : 'REJECTED', adminNote: change.reason },
          });
        }
        if (next === OrderStatus.RETURNED) await this.restock(tx, stock, order.id, 'Customer return received');
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: next,
          ...(change.trackingNumber && { trackingNumber: change.trackingNumber }),
          ...(change.courier && { courier: change.courier }),
          ...(next === OrderStatus.SHIPPED && { shippedAt: new Date() }),
          ...(next === OrderStatus.DELIVERED && !order.deliveredAt && { deliveredAt: new Date() }),
        },
      });
      await this.audit.record(
        actor ?? { email: 'system' },
        {
          action: 'order.status',
          entityType: 'Order',
          entityId: id,
          before: { status: order.status },
          after: { status: next, trackingNumber: change.trackingNumber, courier: change.courier, reason: change.reason },
        },
        tx,
      );
      return {
        order: updated,
        from: order.status,
        email: order.customerEmail ?? order.customer.email,
        name: order.customer.firstName,
      };
    });

    const template = ({ SHIPPED: 'order.shipped', DELIVERED: 'order.delivered', CANCELLED: 'order.cancelled' } as Record<string, string>)[next];
    // Rejecting a return moves the order back to DELIVERED — that is not a new delivery.
    if (template && result.from !== OrderStatus.RETURN_REQUESTED) {
      this.notifications.notify({
        template,
        to: result.email,
        orderId: id,
        customerId: result.order.customerId,
        context: {
          orderNumber: result.order.orderNumber,
          total: result.order.total,
          customerName: result.name,
          trackingNumber: result.order.trackingNumber,
          courier: result.order.courier,
          reason: change.reason,
        },
      });
    }
    return this.adminGet(id);
  }

  private returnDeadline(deliveredAt: Date | null, windowDays: number) {
    if (!deliveredAt || windowDays <= 0) return null;
    return new Date(deliveredAt.getTime() + windowDays * 24 * 3600_000);
  }

  private async findByIdempotencyKey(customerId: string, idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: { customerId_idempotencyKey: { customerId, idempotencyKey } },
      include: customerOrderInclude,
    });
  }

  private async releaseCoupon(tx: Tx, orderId: string) {
    const usage = await tx.couponUsage.findUnique({ where: { orderId } });
    if (!usage) return;
    await tx.couponUsage.delete({ where: { id: usage.id } });
    await tx.coupon.update({ where: { id: usage.couponId }, data: { usedCount: { decrement: 1 } } });
  }

  private async manualProviderConfigured(provider: PaymentProvider) {
    const all = await this.settings.all();
    if (provider === PaymentProvider.UPI_DIRECT) return Boolean(all['payments.upiId']);
    return Boolean(all['payments.bankAccountNumber'] && all['payments.bankIfsc']);
  }

  private async restock(tx: Tx, lines: StockLine[], orderId: string, reason: string) {
    for (const line of lines) {
      const item = await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { quantity: { increment: line.quantity } },
      });
      await tx.inventoryMovement.create({
        data: { inventoryItemId: item.id, type: 'RETURN', delta: line.quantity, orderId, reason },
      });
    }
  }

  private async expireStalePendingOrders() {
    const ttlMinutes = Number(await this.settings.get('checkout.pendingOrderTtlMinutes'));
    const manualHours = Number(await this.settings.get('checkout.manualPaymentHoldHours'));
    const manual = { payments: { some: { provider: { in: MANUAL_PROVIDERS } } } };
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        OR: [
          // Gateway checkouts: short hold.
          { NOT: manual, placedAt: { lt: new Date(Date.now() - ttlMinutes * 60_000) } },
          // Direct UPI / bank transfer: longer hold. Orders whose customer already submitted
          // a payment reference (status SUBMITTED) are never auto-expired.
          {
            payments: { some: { provider: { in: MANUAL_PROVIDERS }, status: 'PENDING' } },
            NOT: { payments: { some: { status: 'SUBMITTED' } } },
            placedAt: { lt: new Date(Date.now() - manualHours * 3600_000) },
          },
        ],
      },
      select: { id: true },
      take: 100,
    });
    for (const { id } of stale) {
      await this.transition(null, id, { status: OrderStatus.CANCELLED, reason: 'Payment not received in time' }, 'EXPIRED').catch(
        () => undefined,
      );
    }
    if (stale.length) this.logger.log(`Expired ${stale.length} unpaid order(s)`);
    return stale.length;
  }

  private async price(db: Tx | PrismaService, customerId: string, items: CheckoutItemDto[], couponCode?: string) {
    const merged = toStockLines(items);
    const variants = await db.productVariant.findMany({
      where: { id: { in: merged.map((i) => i.variantId) }, isActive: true, product: { status: 'ACTIVE' } },
      include: { product: { select: { name: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    const lines = merged.map(({ variantId, quantity }) => {
      const variant = byId.get(variantId);
      if (!variant) throw new BadRequestException(`An item in your bag is no longer available`);
      return {
        variantId,
        quantity,
        productName: `${variant.product.name} — ${variant.title}`,
        sku: variant.sku,
        unitPrice: variant.price,
        lineTotal: variant.price * quantity,
        gstRate: Number(variant.gstRate),
      };
    });
    const { subtotal, tax } = priceLines(lines);

    let discount = 0;
    let coupon = null;
    if (couponCode) {
      const evaluated = await this.coupons.evaluate(couponCode, customerId, subtotal, db);
      coupon = evaluated.coupon;
      discount = evaluated.discount;
    }

    const settings = await this.settings.all();
    const afterDiscount = subtotal - discount;
    const shipping = shippingFor(afterDiscount, Number(settings['shipping.flatRate']), Number(settings['shipping.freeAbove']));

    return {
      lines: lines.map(({ gstRate: _gst, ...line }) => line),
      subtotal,
      discount,
      shipping,
      tax,
      total: afterDiscount + shipping,
      coupon,
    };
  }
}

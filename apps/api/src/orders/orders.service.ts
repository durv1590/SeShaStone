import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OrderStatus, PaymentProvider, Prisma } from '@prisma/client';
import { AddressesService } from '../addresses/addresses.service';
import { paginated } from '../common/dto/pagination.dto';
import { generateOrderNumber } from '../common/utils/order-number';
import { CouponsService } from '../coupons/coupons.service';
import { InventoryService, StockLine } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CheckoutDto, CheckoutItemDto, ListOrdersDto, UpdateOrderStatusDto } from './orders.dto';

type Tx = Prisma.TransactionClient;

/** Allowed admin-driven status transitions. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'CANCELLED', 'REFUNDED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};

const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.OrderInclude;

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
  ) {}

  onModuleInit() {
    // Release stock held by abandoned checkouts every 5 minutes.
    this.expiryTimer = setInterval(() => {
      this.expireStalePendingOrders().catch((err) =>
        this.logger.warn(`Pending order expiry failed: ${err.message}`),
      );
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
    const address = await this.addresses.findOwned(customerId, dto.addressId);
    const enabled = await this.settings.get('payments.enabledProviders');
    const codEnabled = await this.settings.get('checkout.codEnabled');
    const isCod = dto.paymentProvider === PaymentProvider.COD;
    if (isCod ? !codEnabled : !(enabled as readonly string[]).includes(dto.paymentProvider)) {
      throw new BadRequestException('Selected payment method is not available');
    }

    return this.prisma.$transaction(async (tx) => {
      const pricing = await this.price(tx, customerId, dto.items, dto.couponCode);
      const { coupon, ...totals } = pricing;

      const order = await tx.order.create({
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
          shippingAddress: {
            fullName: address.fullName,
            phone: address.phone,
            line1: address.line1,
            line2: address.line2,
            landmark: address.landmark,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            country: address.country,
          },
          items: { create: totals.lines },
        },
      });

      const stock = toStockLines(dto.items);
      await this.inventory.reserve(tx, stock, order.id);
      if (coupon) await this.coupons.redeem(tx, coupon, customerId, order.id);

      if (isCod) {
        await this.inventory.commit(tx, stock, order.id);
        await tx.payment.create({
          data: { orderId: order.id, provider: 'COD', status: 'PENDING', amount: order.total },
        });
      }

      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
    });
  }

  async listMine(customerId: string, query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = { customerId, ...(query.status && { status: query.status }) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true },
        orderBy: { placedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async findMine(customerId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async cancelMine(customerId: string, id: string) {
    const order = await this.findMine(customerId, id);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Only unpaid orders can be cancelled online; contact support');
    }
    return this.transition(id, OrderStatus.CANCELLED);
  }

  // ── Admin ──────────────────────────────────────────────────

  async adminList(query: ListOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && {
        OR: [
          { orderNumber: { contains: query.q, mode: 'insensitive' } },
          { customer: { email: { contains: query.q, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
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
        ...orderInclude,
        customer: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async adminUpdateStatus(id: string, dto: UpdateOrderStatusDto) {
    return this.transition(id, dto.status, dto.trackingNumber);
  }

  async stats() {
    const since = new Date(Date.now() - 30 * 24 * 3600_000);
    const paidStatuses: OrderStatus[] = ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    const [revenue, byStatus, customers] = await this.prisma.$transaction([
      this.prisma.order.aggregate({
        where: { status: { in: paidStatuses }, placedAt: { gte: since } },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.customer.count({ where: { role: 'CUSTOMER', createdAt: { gte: since } } }),
    ]);
    return {
      last30Days: {
        revenue: revenue._sum.total ?? 0,
        orders: revenue._count,
        newCustomers: customers,
      },
      ordersByStatus: Object.fromEntries(
        byStatus.map((s) => [s.status, (s._count as { _all: number })._all]),
      ),
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

  private async transition(id: string, next: OrderStatus, trackingNumber?: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (!TRANSITIONS[order.status].includes(next)) {
        throw new BadRequestException(`Cannot move order from ${order.status} to ${next}`);
      }
      const stock = toStockLines(order.items);
      if (next === OrderStatus.CANCELLED) {
        if (order.status === OrderStatus.PENDING_PAYMENT) {
          await this.inventory.release(tx, stock, order.id);
        } else {
          await this.restock(tx, stock, order.id);
        }
        const usage = await tx.couponUsage.findUnique({ where: { orderId: order.id } });
        if (usage) {
          await tx.couponUsage.delete({ where: { id: usage.id } });
          await tx.coupon.update({
            where: { id: usage.couponId },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }
      if (next === OrderStatus.DELIVERED) {
        // Cash on delivery is collected by the courier at handover.
        await tx.payment.updateMany({
          where: { orderId: order.id, provider: 'COD', status: 'PENDING' },
          data: { status: 'CAPTURED' },
        });
      }
      return tx.order.update({
        where: { id },
        data: { status: next, ...(trackingNumber && { trackingNumber }) },
        include: orderInclude,
      });
    });
  }

  private async restock(tx: Tx, lines: StockLine[], orderId: string) {
    for (const line of lines) {
      const item = await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { quantity: { increment: line.quantity } },
      });
      await tx.inventoryMovement.create({
        data: {
          inventoryItemId: item.id,
          type: 'RETURN',
          delta: line.quantity,
          orderId,
          reason: 'Order cancelled',
        },
      });
    }
  }

  private async expireStalePendingOrders() {
    const ttl = await this.settings.get('checkout.pendingOrderTtlMinutes');
    const stale = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        placedAt: { lt: new Date(Date.now() - Number(ttl) * 60_000) },
      },
      select: { id: true },
      take: 100,
    });
    for (const { id } of stale) {
      await this.transition(id, OrderStatus.CANCELLED).catch(() => undefined);
    }
    if (stale.length) this.logger.log(`Expired ${stale.length} unpaid order(s)`);
  }

  private async price(
    db: Tx | PrismaService,
    customerId: string,
    items: CheckoutItemDto[],
    couponCode?: string,
  ) {
    const merged = toStockLines(items);
    const variants = await db.productVariant.findMany({
      where: { id: { in: merged.map((i) => i.variantId) }, isActive: true, product: { status: 'ACTIVE' } },
      include: { product: { select: { name: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    let subtotal = 0;
    let tax = 0;
    const lines = merged.map(({ variantId, quantity }) => {
      const variant = byId.get(variantId);
      if (!variant) throw new BadRequestException(`Item ${variantId} is no longer available`);
      const lineTotal = variant.price * quantity;
      subtotal += lineTotal;
      // Prices are GST-inclusive; extract the tax component for invoicing.
      const rate = Number(variant.gstRate);
      tax += Math.round((lineTotal * rate) / (100 + rate));
      return {
        variantId,
        quantity,
        productName: `${variant.product.name} — ${variant.title}`,
        sku: variant.sku,
        unitPrice: variant.price,
        lineTotal,
      };
    });

    let discount = 0;
    let coupon = null;
    if (couponCode) {
      const evaluated = await this.coupons.evaluate(couponCode, customerId, subtotal, db);
      coupon = evaluated.coupon;
      discount = evaluated.discount;
    }

    const flatRate = Number(await this.settings.get('shipping.flatRate'));
    const freeAbove = Number(await this.settings.get('shipping.freeAbove'));
    const afterDiscount = subtotal - discount;
    const shipping = freeAbove > 0 && afterDiscount >= freeAbove ? 0 : flatRate;

    return { lines, subtotal, discount, shipping, tax, total: afterDiscount + shipping, coupon };
  }
}

/** Merges duplicate variant lines so each variant is reserved once. */
function toStockLines(items: { variantId: string; quantity: number }[]): StockLine[] {
  const merged = new Map<string, number>();
  for (const { variantId, quantity } of items) {
    merged.set(variantId, (merged.get(variantId) ?? 0) + quantity);
  }
  return [...merged].map(([variantId, quantity]) => ({ variantId, quantity }));
}

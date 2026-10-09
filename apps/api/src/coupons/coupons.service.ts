import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Coupon, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './coupons.dto';

type Db = Prisma.TransactionClient | PrismaService;

export function computeDiscount(coupon: Coupon, subtotal: number): number {
  const raw =
    coupon.type === 'PERCENTAGE' ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  const capped = coupon.maxDiscount != null ? Math.min(raw, coupon.maxDiscount) : raw;
  return Math.min(capped, subtotal);
}

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreateCouponDto) {
    this.assertValidValue(dto.type, dto.value);
    return this.prisma.coupon.create({ data: dto });
  }

  async update(id: string, dto: UpdateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found');
    this.assertValidValue(dto.type ?? existing.type, dto.value ?? existing.value);
    return this.prisma.coupon.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }

  /** Validates a coupon for a customer's cart and returns the discount in paise. */
  async evaluate(code: string, customerId: string, subtotal: number, db: Db = this.prisma) {
    const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();
    if (
      !coupon ||
      !coupon.isActive ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt < now)
    ) {
      throw new BadRequestException('This coupon is not valid');
    }
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      throw new BadRequestException('This coupon has reached its usage limit');
    }
    if (subtotal < coupon.minOrderValue) {
      throw new BadRequestException(
        `Minimum order value for this coupon is ₹${(coupon.minOrderValue / 100).toFixed(2)}`,
      );
    }
    if (coupon.perCustomerLimit != null) {
      const used = await db.couponUsage.count({ where: { couponId: coupon.id, customerId } });
      if (used >= coupon.perCustomerLimit) {
        throw new BadRequestException('You have already used this coupon');
      }
    }
    return { coupon, discount: computeDiscount(coupon, subtotal) };
  }

  /** Records coupon redemption; the conditional update guards the global usage limit. */
  async redeem(tx: Prisma.TransactionClient, coupon: Coupon, customerId: string, orderId: string) {
    const updated = await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
       WHERE id = ${coupon.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
    if (updated === 0) throw new BadRequestException('This coupon has reached its usage limit');
    await tx.couponUsage.create({ data: { couponId: coupon.id, customerId, orderId } });
  }

  private assertValidValue(type: Coupon['type'], value: number) {
    if (type === 'PERCENTAGE' && value > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }
  }
}

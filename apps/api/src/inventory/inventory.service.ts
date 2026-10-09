import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto, ListInventoryDto } from './inventory.dto';

type Tx = Prisma.TransactionClient;
export interface StockLine {
  variantId: string;
  quantity: number;
}

/**
 * Stock lifecycle: RESERVE on checkout → SALE on payment capture (or RELEASE on
 * cancel/failure). Reservation uses a conditional UPDATE so concurrent checkouts
 * can never oversell a piece.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListInventoryDto) {
    const where: Prisma.InventoryItemWhereInput = query.q
      ? {
          variant: {
            OR: [
              { sku: { contains: query.q, mode: 'insensitive' } },
              { product: { name: { contains: query.q, mode: 'insensitive' } } },
            ],
          },
        }
      : {};
    const include = {
      variant: { select: { sku: true, title: true, product: { select: { id: true, name: true } } } },
    } satisfies Prisma.InventoryItemInclude;

    if (query.lowStock) {
      // Column-to-column comparison isn't expressible in Prisma's where API.
      const low = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "InventoryItem" WHERE quantity - reserved <= "lowStockThreshold"`;
      where.id = { in: low.map((r) => r.id) };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({
        where,
        include,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return paginated(
      items.map((i) => ({ ...i, available: i.quantity - i.reserved })),
      total,
      query,
    );
  }

  history(variantId: string) {
    return this.prisma.inventoryMovement.findMany({
      where: { inventoryItem: { variantId } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async adjust(variantId: string, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { variantId } });
      if (!item) throw new NotFoundException('Inventory record not found');
      if (item.quantity + dto.delta < item.reserved) {
        throw new BadRequestException('Adjustment would drop stock below reserved quantity');
      }
      await tx.inventoryMovement.create({
        data: { inventoryItemId: item.id, type: dto.type, delta: dto.delta, reason: dto.reason },
      });
      return tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: { increment: dto.delta } },
      });
    });
  }

  setThreshold(variantId: string, lowStockThreshold: number) {
    return this.prisma.inventoryItem.update({ where: { variantId }, data: { lowStockThreshold } });
  }

  // ── Order lifecycle (called inside the order/payment transactions) ─────

  async reserve(tx: Tx, lines: StockLine[], orderId: string) {
    for (const line of lines) {
      const updated = await tx.$executeRaw`
        UPDATE "InventoryItem"
           SET reserved = reserved + ${line.quantity}, "updatedAt" = NOW()
         WHERE "variantId" = ${line.variantId}
           AND quantity - reserved >= ${line.quantity}`;
      if (updated === 0) {
        throw new BadRequestException(`Insufficient stock for variant ${line.variantId}`);
      }
      await this.log(tx, line, 'RESERVE', line.quantity, orderId);
    }
  }

  async release(tx: Tx, lines: StockLine[], orderId: string) {
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { reserved: { decrement: line.quantity } },
      });
      await this.log(tx, line, 'RELEASE', -line.quantity, orderId);
    }
  }

  /** Converts a reservation into a sale once payment is captured. */
  async commit(tx: Tx, lines: StockLine[], orderId: string) {
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { reserved: { decrement: line.quantity }, quantity: { decrement: line.quantity } },
      });
      await this.log(tx, line, 'SALE', -line.quantity, orderId);
    }
  }

  private async log(
    tx: Tx,
    line: StockLine,
    type: 'RESERVE' | 'RELEASE' | 'SALE',
    delta: number,
    orderId: string,
  ) {
    const item = await tx.inventoryItem.findUniqueOrThrow({
      where: { variantId: line.variantId },
      select: { id: true },
    });
    await tx.inventoryMovement.create({
      data: { inventoryItemId: item.id, type, delta, orderId },
    });
  }
}

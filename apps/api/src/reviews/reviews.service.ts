import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto, ListReviewsDto } from './reviews.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async forProduct(productId: string, query: PaginationDto) {
    const where: Prisma.ReviewWhereInput = { productId, status: 'APPROVED' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: { customer: { select: { firstName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  /** Only customers with a delivered order containing the product may review it. */
  async create(customerId: string, dto: CreateReviewDto) {
    const purchased = await this.prisma.orderItem.count({
      where: {
        variant: { productId: dto.productId },
        order: { customerId, status: 'DELIVERED' },
      },
    });
    if (!purchased) throw new BadRequestException('You can review products you have received');
    try {
      return await this.prisma.review.create({ data: { ...dto, customerId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('You have already reviewed this product');
      }
      throw err;
    }
  }

  async adminList(query: ListReviewsDto) {
    const where: Prisma.ReviewWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        include: {
          customer: { select: { email: true, firstName: true } },
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  moderate(id: string, status: Prisma.ReviewUpdateInput['status']) {
    return this.prisma.review.update({ where: { id }, data: { status } });
  }
}

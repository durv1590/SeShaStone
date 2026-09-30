import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUpdateCustomerDto, ListCustomersDto, UpdateProfileDto } from './customers.dto';

const publicFields = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  marketingOptIn: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      select: { ...publicFields, _count: { select: { orders: true } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  updateProfile(id: string, dto: UpdateProfileDto) {
    return this.prisma.customer.update({ where: { id }, data: dto, select: publicFields });
  }

  async list(query: ListCustomersDto) {
    const where: Prisma.CustomerWhereInput = query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: 'insensitive' } },
            { firstName: { contains: query.q, mode: 'insensitive' } },
            { lastName: { contains: query.q, mode: 'insensitive' } },
            { phone: { contains: query.q } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        select: publicFields,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.customer.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async adminUpdate(id: string, dto: AdminUpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto, select: publicFields });
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './addresses.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOwned(customerId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, customerId } });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(customerId: string, dto: CreateAddressDto) {
    const isFirst = (await this.prisma.address.count({ where: { customerId } })) === 0;
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: { ...dto, customerId, isDefault: dto.isDefault ?? isFirst },
      });
    });
  }

  async update(customerId: string, id: string, dto: UpdateAddressDto) {
    await this.findOwned(customerId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({ where: { customerId }, data: { isDefault: false } });
      }
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async remove(customerId: string, id: string) {
    await this.findOwned(customerId, id);
    await this.prisma.address.delete({ where: { id } });
    return { deleted: true };
  }
}

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, SubscribeDto, UpdateCampaignDto } from './marketing.dto';

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(dto: SubscribeDto) {
    const email = dto.email.toLowerCase();
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, source: dto.source },
      update: { unsubscribedAt: null },
    });
    return { subscribed: true };
  }

  async unsubscribe(email: string) {
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email: email.toLowerCase() },
      data: { unsubscribedAt: new Date() },
    });
    return { subscribed: false };
  }

  async subscribers(query: PaginationDto) {
    const where = { unsubscribedAt: null };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  campaigns() {
    return this.prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
  }

  createCampaign(dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: { ...dto, status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT' },
    });
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === 'SENT') throw new BadRequestException('Sent campaigns cannot be edited');
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.scheduledAt !== undefined && { status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT' }),
      },
    });
  }

  async cancelCampaign(id: string) {
    return this.prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}

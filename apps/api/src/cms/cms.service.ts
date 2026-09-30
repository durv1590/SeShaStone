import { Injectable, NotFoundException } from '@nestjs/common';
import { BannerPlacement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateBannerDto, CreatePageDto, UpdateBannerDto, UpdatePageDto } from './cms.dto';

const BANNER_CACHE_PREFIX = 'cms:banners:';

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Pages ──────────────────────────────────────────────────

  async publishedPage(slug: string) {
    const page = await this.prisma.cmsPage.findUnique({ where: { slug } });
    if (!page?.isPublished) throw new NotFoundException('Page not found');
    return page;
  }

  listPages() {
    return this.prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  createPage(dto: CreatePageDto) {
    return this.prisma.cmsPage.create({ data: dto });
  }

  updatePage(id: string, dto: UpdatePageDto) {
    return this.prisma.cmsPage.update({ where: { id }, data: dto });
  }

  async deletePage(id: string) {
    await this.prisma.cmsPage.delete({ where: { id } });
    return { deleted: true };
  }

  // ── Banners ────────────────────────────────────────────────

  async activeBanners(placement: BannerPlacement) {
    const key = BANNER_CACHE_PREFIX + placement;
    const cached = await this.redis.getJson(key);
    if (cached) return cached;
    const now = new Date();
    const banners = await this.prisma.banner.findMany({
      where: {
        placement,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
    await this.redis.setJson(key, banners, 120);
    return banners;
  }

  listBanners() {
    return this.prisma.banner.findMany({ orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }] });
  }

  async createBanner(dto: CreateBannerDto) {
    const banner = await this.prisma.banner.create({ data: dto });
    await this.invalidateBanners();
    return banner;
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const banner = await this.prisma.banner.update({ where: { id }, data: dto });
    await this.invalidateBanners();
    return banner;
  }

  async deleteBanner(id: string) {
    await this.prisma.banner.delete({ where: { id } });
    await this.invalidateBanners();
    return { deleted: true };
  }

  private invalidateBanners() {
    return this.redis.del(...Object.values(BannerPlacement).map((p) => BANNER_CACHE_PREFIX + p));
  }
}

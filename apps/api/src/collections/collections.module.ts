import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import { CollectionRule } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { Actor, CurrentActor } from '../common/decorators/actor.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { slugify } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

class CreateCollectionDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @Matches(/^[a-z0-9-]+$/) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(120) heroTitle?: string;
  @IsOptional() @IsString() @MaxLength(200) heroSubtitle?: string;
  @IsOptional() @IsUrl({ require_tld: false }) heroImageUrl?: string;
  @IsOptional() @IsIn(['ivory', 'charcoal', 'emerald', 'burgundy']) theme?: string;
  @IsOptional() @IsEnum(CollectionRule) rule?: CollectionRule;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() @MaxLength(70) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(160) seoDescription?: string;
}

class UpdateCollectionDto extends PartialType(CreateCollectionDto) {}

const CACHE_KEY = 'collections:active';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async active() {
    const cached = await this.redis.getJson(CACHE_KEY);
    if (cached) return cached;
    const list = await this.prisma.collection.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      omit: { createdAt: true, updatedAt: true },
    });
    await this.redis.setJson(CACHE_KEY, list, 300);
    return list;
  }

  async bySlug(slug: string) {
    const c = await this.prisma.collection.findUnique({ where: { slug } });
    if (!c?.isActive) throw new NotFoundException('Collection not found');
    return c;
  }

  all() {
    return this.prisma.collection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async create(actor: Actor, dto: CreateCollectionDto) {
    const c = await this.prisma.collection.create({ data: { ...dto, slug: dto.slug ?? slugify(dto.name) } });
    await this.audit.record(actor, { action: 'collection.create', entityType: 'Collection', entityId: c.id, after: dto });
    await this.redis.del(CACHE_KEY);
    return c;
  }

  async update(actor: Actor, id: string, dto: UpdateCollectionDto) {
    const c = await this.prisma.collection.update({ where: { id }, data: dto });
    await this.audit.record(actor, { action: 'collection.update', entityType: 'Collection', entityId: id, after: dto });
    await this.redis.del(CACHE_KEY);
    return c;
  }

  async remove(actor: Actor, id: string) {
    await this.prisma.collection.delete({ where: { id } });
    await this.audit.record(actor, { action: 'collection.remove', entityType: 'Collection', entityId: id });
    await this.redis.del(CACHE_KEY);
    return { deleted: true };
  }
}

@ApiTags('collections')
@Controller()
class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Public()
  @Get('collections')
  active() {
    return this.collections.active();
  }

  /** Collection content; products come from GET /products?collection=:slug */
  @Public()
  @Get('collections/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.collections.bySlug(slug);
  }

  @ApiBearerAuth()
  @RequirePermissions('products.view')
  @Get('admin/collections')
  all() {
    return this.collections.all();
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Post('admin/collections')
  create(@CurrentActor() actor: Actor, @Body() dto: CreateCollectionDto) {
    return this.collections.create(actor, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Patch('admin/collections/:id')
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collections.update(actor, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('content.manage')
  @Delete('admin/collections/:id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.collections.remove(actor, id);
  }
}

@Module({ controllers: [CollectionsController], providers: [CollectionsService] })
export class CollectionsModule {}

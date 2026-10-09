import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JewelleryLine, Prisma, ProductStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { Actor } from '../common/decorators/actor.decorator';
import { paginated } from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { ProductSearchDocument, SearchService } from '../search/search.service';
import {
  AdminListProductsDto,
  CreateProductDto,
  ListProductsDto,
  ProductVariantDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './products.dto';

const listInclude = {
  images: { orderBy: { sortOrder: 'asc' }, take: 2 },
  variants: {
    where: { isActive: true },
    select: { id: true, price: true, compareAtPrice: true },
    orderBy: { price: 'asc' },
  },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductInclude;

const detailInclude = {
  collections: { where: { isActive: true }, select: { id: true, name: true, slug: true } },
  images: { orderBy: { sortOrder: 'asc' } },
  variants: {
    orderBy: { price: 'asc' },
    include: { inventory: { select: { quantity: true, reserved: true } } },
  },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchService,
    private readonly audit: AuditService,
  ) {}

  // ── Storefront ─────────────────────────────────────────────

  async list(query: ListProductsDto) {
    // Free-text queries go to the search engine first; fall back to DB on failure.
    if (query.q) {
      const hits = await this.searchIds(query).catch(() => null);
      if (hits) {
        const products = await this.prisma.product.findMany({
          where: { id: { in: hits.ids }, status: ProductStatus.ACTIVE },
          include: listInclude,
        });
        const order = new Map(hits.ids.map((id, i) => [id, i]));
        products.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
        return paginated(products.map(withPriceRange), hits.total, query);
      }
    }

    const priceFilter: Prisma.IntFilter = {};
    if (query.minPrice !== undefined) priceFilter.gte = query.minPrice;
    if (query.maxPrice !== undefined) priceFilter.lte = query.maxPrice;

    // Collections are either hand-picked or rule-based (newest / bestselling).
    let rankedIds: string[] | null = null;
    let collectionWhere: Prisma.ProductWhereInput = {};
    if (query.collection) {
      const collection = await this.prisma.collection.findUnique({ where: { slug: query.collection } });
      if (!collection?.isActive) throw new NotFoundException('Collection not found');
      if (collection.rule === 'MANUAL') collectionWhere = { collections: { some: { id: collection.id } } };
      if (collection.rule === 'BESTSELLING') rankedIds = await this.bestsellerIds(200);
    }
    if (query.sort === 'bestselling' && !rankedIds) rankedIds = await this.bestsellerIds(200);

    const variantFilters: Prisma.ProductVariantWhereInput[] = [];
    if (Object.keys(priceFilter).length) variantFilters.push({ price: priceFilter });
    if (query.size) variantFilters.push({ size: { equals: query.size, mode: 'insensitive' } });
    if (query.inStock) variantFilters.push({ inventory: { quantity: { gt: 0 } } });

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...collectionWhere,
      ...(query.line && { line: query.line }),
      ...(query.category && {
        category: { OR: [{ slug: query.category }, { parent: { slug: query.category } }] },
      }),
      ...(query.metal && { metal: query.metal }),
      ...(query.gemstone && { gemstone: { equals: query.gemstone, mode: 'insensitive' } }),
      ...(query.tag && { tags: { has: query.tag.toLowerCase() } }),
      ...(query.featured !== undefined && { isFeatured: query.featured }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { tags: { has: query.q.toLowerCase() } },
          { gemstone: { contains: query.q, mode: 'insensitive' } },
          { category: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      }),
      ...(variantFilters.length && { variants: { some: { isActive: true, AND: variantFilters } } }),
      ...(rankedIds && { id: { in: rankedIds } }),
    };

    if (rankedIds) {
      // Rank in application order; the bestseller list is small and bounded.
      const all = await this.prisma.product.findMany({ where, include: listInclude });
      const rank = new Map(rankedIds.map((id, i) => [id, i]));
      all.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
      return paginated(all.slice(query.skip, query.skip + query.pageSize).map(withPriceRange), all.length, query);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Price sorting is applied within the page; switch to a denormalised min-price
    // column (or the search index) if strict global ordering becomes necessary.
    const rows = items.map(withPriceRange);
    if (query.sort === 'price_asc') rows.sort((a, b) => a.minPrice - b.minPrice);
    if (query.sort === 'price_desc') rows.sort((a, b) => b.minPrice - a.minPrice);
    return paginated(rows, total, query);
  }

  /** Product ids ranked by units sold on paid (not cancelled / refunded) orders. */
  async bestsellerIds(limit: number) {
    const rows = await this.prisma.$queryRaw<{ productId: string }[]>`
      SELECT v."productId" AS "productId"
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        JOIN "ProductVariant" v ON v.id = oi."variantId"
       WHERE o.status IN ('PAID','PROCESSING','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED')
       GROUP BY v."productId"
       ORDER BY SUM(oi.quantity) DESC
       LIMIT ${limit}`;
    return rows.map((r) => r.productId);
  }

  /** Other active pieces from the same line (and category first). */
  async related(slug: string, limit = 4) {
    const product = await this.prisma.product.findUnique({ where: { slug }, select: { id: true, line: true, categoryId: true } });
    if (!product) throw new NotFoundException('Product not found');
    const base: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE, id: { not: product.id }, ...(product.line && { line: product.line }) };
    const sameCategory = product.categoryId
      ? await this.prisma.product.findMany({ where: { ...base, categoryId: product.categoryId }, include: listInclude, take: limit })
      : [];
    const rest =
      sameCategory.length < limit
        ? await this.prisma.product.findMany({
            where: { ...base, id: { notIn: [product.id, ...sameCategory.map((p) => p.id)] } },
            include: listInclude,
            orderBy: { createdAt: 'desc' },
            take: limit - sameCategory.length,
          })
        : [];
    return [...sameCategory, ...rest].map(withPriceRange);
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: {
        ...detailInclude,
        variants: { ...detailInclude.variants, where: { isActive: true } },
      },
    });
    if (!product || product.status !== ProductStatus.ACTIVE) {
      throw new NotFoundException('Product not found');
    }
    const rating = await this.prisma.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: true,
    });
    return {
      ...product,
      variants: product.variants.map(({ inventory, ...v }) => ({
        ...v,
        inStock: (inventory?.quantity ?? 0) - (inventory?.reserved ?? 0) > 0,
      })),
      rating: { average: rating._avg.rating, count: rating._count },
    };
  }

  // ── Admin ──────────────────────────────────────────────────

  async adminList(query: AdminListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.line && { line: query.line }),
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { variants: { some: { sku: { contains: query.q, mode: 'insensitive' } } } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(items.map(withPriceRange), total, query);
  }

  async adminGet(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: detailInclude });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(actor: Actor, dto: CreateProductDto) {
    const { images, variants, collectionIds, ...data } = dto;
    assertPublishable(dto.status, dto.line);
    const product = await this.prisma.product.create({
      data: {
        ...data,
        slug: dto.slug ?? slugify(dto.name),
        images: images?.length ? { create: images } : undefined,
        variants: { create: variants.map(toVariantCreate) },
        collections: collectionIds?.length ? { connect: collectionIds.map((id) => ({ id })) } : undefined,
      },
      include: detailInclude,
    });
    await this.audit.record(actor, { action: 'product.create', entityType: 'Product', entityId: product.id, after: { name: product.name, status: product.status } });
    await this.syncSearch(product.id);
    return product;
  }

  async update(actor: Actor, id: string, dto: UpdateProductDto) {
    const { images, collectionIds, ...data } = dto;
    const before = await this.adminGet(id);
    assertPublishable(dto.status ?? before.status, dto.line !== undefined ? dto.line : before.line);
    const product = await this.prisma.$transaction(async (tx) => {
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i, productId: id })),
        });
      }
      return tx.product.update({
        where: { id },
        data: { ...data, ...(collectionIds && { collections: { set: collectionIds.map((cid) => ({ id: cid })) } }) },
        include: detailInclude,
      });
    });
    const changed = Object.keys(dto).filter((k) => k !== 'images');
    await this.audit.record(actor, { action: 'product.update', entityType: 'Product', entityId: id, after: { fields: changed, status: product.status } });
    await this.syncSearch(id);
    return product;
  }

  async remove(actor: Actor, id: string) {
    await this.audit.record(actor, { action: 'product.remove', entityType: 'Product', entityId: id });
    // Products referenced by orders are archived rather than deleted.
    const ordered = await this.prisma.orderItem.count({ where: { variant: { productId: id } } });
    if (ordered) {
      await this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
    } else {
      await this.prisma.product.delete({ where: { id } });
    }
    await this.search.removeProduct(id);
    return { deleted: !ordered, archived: !!ordered };
  }

  async addVariant(productId: string, dto: ProductVariantDto) {
    await this.adminGet(productId);
    const variant = await this.prisma.productVariant.create({
      data: { ...toVariantCreate(dto), product: { connect: { id: productId } } },
    });
    await this.syncSearch(productId);
    return variant;
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.update({ where: { id: variantId }, data: dto });
    await this.syncSearch(variant.productId);
    return variant;
  }

  /** Rebuilds the search index from the database. */
  async reindexAll() {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: listInclude,
    });
    await this.search.indexProducts(products.map(toSearchDoc));
    return { indexed: products.length };
  }

  private async syncSearch(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: listInclude });
    if (product?.status === ProductStatus.ACTIVE) {
      await this.search.indexProducts([toSearchDoc(product)]);
    } else {
      await this.search.removeProduct(id);
    }
  }

  private async searchIds(query: ListProductsDto) {
    const filter: string[] = [];
    if (query.metal) filter.push(`metal = "${query.metal}"`);
    if (query.gemstone) filter.push(`gemstone = "${query.gemstone.replace(/"/g, '')}"`);
    if (query.minPrice !== undefined) filter.push(`minPrice >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) filter.push(`minPrice <= ${query.maxPrice}`);
    const res = await this.search.searchProducts(query.q!, {
      filter,
      limit: query.pageSize,
      offset: query.skip,
    });
    return { ids: res.hits.map((h) => h.id), total: res.estimatedTotalHits ?? res.hits.length };
  }
}

type ListProduct = Prisma.ProductGetPayload<{ include: typeof listInclude }>;

function withPriceRange(product: ListProduct) {
  const prices = product.variants.map((v) => v.price);
  return {
    ...product,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}

function toSearchDoc(product: ListProduct): ProductSearchDocument {
  const { minPrice } = withPriceRange(product);
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category?.name,
    line: product.line,
    metal: product.metal,
    purity: product.purity,
    gemstone: product.gemstone,
    tags: product.tags,
    minPrice,
    imageUrl: product.images[0]?.url,
  };
}

function toVariantCreate({ stock, ...variant }: ProductVariantDto) {
  return {
    ...variant,
    inventory: {
      create: {
        quantity: stock ?? 0,
        movements: stock
          ? { create: { type: 'RESTOCK' as const, delta: stock, reason: 'Initial stock' } }
          : undefined,
      },
    },
  } satisfies Prisma.ProductVariantCreateWithoutProductInput;
}

/** Every live product must declare its jewellery line so material is never misrepresented. */
function assertPublishable(status: ProductStatus | undefined, line: JewelleryLine | null | undefined) {
  if (status === ProductStatus.ACTIVE && !line) {
    throw new BadRequestException('Choose the jewellery line (Gold, Silver, Diamond or Premium Artificial) before publishing');
  }
}

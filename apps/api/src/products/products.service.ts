import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
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

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(query.category && {
        category: { OR: [{ slug: query.category }, { parent: { slug: query.category } }] },
      }),
      ...(query.metal && { metal: query.metal }),
      ...(query.gemstone && { gemstone: { equals: query.gemstone, mode: 'insensitive' } }),
      ...(query.featured !== undefined && { isFeatured: query.featured }),
      ...(query.q && { name: { contains: query.q, mode: 'insensitive' } }),
      ...(Object.keys(priceFilter).length && {
        variants: { some: { isActive: true, price: priceFilter } },
      }),
    };

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

  async create(dto: CreateProductDto) {
    const { images, variants, ...data } = dto;
    const product = await this.prisma.product.create({
      data: {
        ...data,
        slug: dto.slug ?? slugify(dto.name),
        images: images?.length ? { create: images } : undefined,
        variants: { create: variants.map(toVariantCreate) },
      },
      include: detailInclude,
    });
    await this.syncSearch(product.id);
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const { images, ...data } = dto;
    await this.adminGet(id);
    const product = await this.prisma.$transaction(async (tx) => {
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i, productId: id })),
        });
      }
      return tx.product.update({ where: { id }, data, include: detailInclude });
    });
    await this.syncSearch(id);
    return product;
  }

  async remove(id: string) {
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

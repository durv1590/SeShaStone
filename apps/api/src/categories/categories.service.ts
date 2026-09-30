import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { slugify } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

const TREE_CACHE_KEY = 'categories:tree';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Active categories as a nested tree for storefront navigation (cached). */
  async tree() {
    const cached = await this.redis.getJson(TREE_CACHE_KEY);
    if (cached) return cached;

    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    type Node = (typeof categories)[number] & { children: Node[] };
    const byId = new Map<string, Node>(categories.map((c) => [c.id, { ...c, children: [] }]));
    const roots: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    await this.redis.setJson(TREE_CACHE_KEY, roots, 600);
    return roots;
  }

  listAll() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: { children: { where: { isActive: true } } },
    });
    if (!category || !category.isActive) throw new NotFoundException('Category not found');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const category = await this.prisma.category.create({
      data: { ...dto, slug: dto.slug ?? slugify(dto.name) },
    });
    await this.redis.del(TREE_CACHE_KEY);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
    const category = await this.prisma.category.update({ where: { id }, data: dto });
    await this.redis.del(TREE_CACHE_KEY);
    return category;
  }

  async remove(id: string) {
    await this.prisma.category.delete({ where: { id } });
    await this.redis.del(TREE_CACHE_KEY);
    return { deleted: true };
  }
}

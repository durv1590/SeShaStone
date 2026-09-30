import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@seshastone.com').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  await prisma.customer.upsert({
    where: { email },
    update: {},
    create: {
      email,
      firstName: 'Store',
      lastName: 'Admin',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

  const rings = await prisma.category.upsert({
    where: { slug: 'rings' },
    update: {},
    create: { name: 'Rings', slug: 'rings', sortOrder: 1 },
  });
  await prisma.category.upsert({
    where: { slug: 'necklaces' },
    update: {},
    create: { name: 'Necklaces', slug: 'necklaces', sortOrder: 2 },
  });
  await prisma.category.upsert({
    where: { slug: 'earrings' },
    update: {},
    create: { name: 'Earrings', slug: 'earrings', sortOrder: 3 },
  });

  await prisma.product.upsert({
    where: { slug: 'ruby-solitaire-ring' },
    update: {},
    create: {
      name: 'Ruby Solitaire Ring',
      slug: 'ruby-solitaire-ring',
      description: 'A natural Burmese ruby set in hallmarked 18K gold.',
      status: 'ACTIVE',
      categoryId: rings.id,
      metal: 'GOLD',
      purity: '18K',
      gemstone: 'Ruby',
      isCertified: true,
      isFeatured: true,
      tags: ['ruby', 'solitaire', 'gold'],
      variants: {
        create: ['12', '14', '16'].map((size) => ({
          sku: `SSS-RR-18K-${size}`,
          title: `Size ${size} / 18K`,
          size,
          weightGrams: 3.2,
          price: 4_850_000, // ₹48,500
          compareAtPrice: 5_200_000,
          inventory: { create: { quantity: 3 } },
        })),
      },
    },
  });

  await prisma.cmsPage.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      title: 'About Se Sha Stone',
      content: 'Handcrafted fine jewellery with certified gemstones.',
      isPublished: true,
    },
  });

  console.log(`Seeded. Admin login: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

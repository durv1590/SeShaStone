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

  // Store details come from the (untracked) .env so bank/UPI data never lands in git.
  // Existing values are left alone so edits made in the admin panel survive re-seeding.
  const storeSettings: Record<string, string | undefined> = {
    'store.legalName': process.env.SEED_STORE_LEGAL_NAME,
    'store.website': process.env.SEED_STORE_WEBSITE,
    'store.supportEmail': process.env.SEED_STORE_EMAIL,
    'store.supportPhone': process.env.SEED_STORE_PHONE,
    'payments.upiId': process.env.SEED_UPI_ID,
    'payments.upiPayeeName': process.env.SEED_UPI_PAYEE_NAME,
    'payments.bankName': process.env.SEED_BANK_NAME,
    'payments.bankAccountName': process.env.SEED_BANK_ACCOUNT_NAME,
    'payments.bankAccountNumber': process.env.SEED_BANK_ACCOUNT_NUMBER,
    'payments.bankIfsc': process.env.SEED_BANK_IFSC,
  };
  for (const [key, value] of Object.entries(storeSettings)) {
    if (!value) continue;
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

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
    where: { slug: 'premium-artificial-jewellery' },
    update: {},
    create: { name: 'Premium Artificial Jewellery', slug: 'premium-artificial-jewellery', sortOrder: 10 },
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

  const contactLines = [
    process.env.SEED_STORE_LEGAL_NAME,
    process.env.SEED_STORE_EMAIL && `Email: ${process.env.SEED_STORE_EMAIL}`,
    process.env.SEED_STORE_PHONE && `Phone / WhatsApp: ${process.env.SEED_STORE_PHONE}`,
    process.env.SEED_STORE_WEBSITE && `Website: ${process.env.SEED_STORE_WEBSITE}`,
  ].filter(Boolean);
  await prisma.cmsPage.upsert({
    where: { slug: 'contact' },
    update: {},
    create: {
      slug: 'contact',
      title: 'Contact us',
      content: [
        'We would love to help you choose, size or customise a piece.',
        contactLines.join('\n'),
      ]
        .filter(Boolean)
        .join('\n\n'),
      isPublished: true,
    },
  });

  await prisma.cmsPage.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      title: 'About SeSha Stone',
      content:
        'Where every stone tells a story.\n\nSeSha Stone Pvt. Ltd. brings you premium gold, silver, diamond and artificial jewellery for every celebration — crafted for timeless elegance.',
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

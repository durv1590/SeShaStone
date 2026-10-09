/**
 * Idempotent seed. Safe to re-run: existing rows and admin-edited settings are never overwritten.
 *
 * Business, bank and UPI details come from the untracked .env (SEED_* variables) so they never
 * enter the public repository. Demo products are created only when SEED_DEMO_PRODUCTS=true —
 * production must use real, verified product data entered through the admin panel.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeQrImage, parseUpiUri } from '../src/common/utils/upi-qr';
import { sniffFileType, toBytes } from '../src/common/utils/file-type';

const prisma = new PrismaClient();
const env = (key: string) => process.env[key]?.trim() || undefined;

async function seedAdmin() {
  const email = (env('SEED_ADMIN_EMAIL') ?? 'admin@seshastone.com').toLowerCase();
  const password = env('SEED_ADMIN_PASSWORD') ?? 'ChangeMe123!';
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    // Upgrade the original seeded ADMIN to SUPER_ADMIN so it can manage staff accounts.
    if (existing.role === 'ADMIN') {
      await prisma.customer.update({ where: { email }, data: { role: 'SUPER_ADMIN' } });
    }
    return email;
  }
  await prisma.customer.create({
    data: {
      email,
      firstName: 'Store',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  return email;
}

async function seedSettings() {
  const values: Record<string, string | undefined> = {
    'store.legalName': env('SEED_STORE_LEGAL_NAME'),
    'store.website': env('SEED_STORE_WEBSITE'),
    'store.supportEmail': env('SEED_STORE_EMAIL'),
    'store.supportPhone': env('SEED_STORE_PHONE'),
    'store.whatsapp': env('SEED_STORE_WHATSAPP'),
    'store.address': env('SEED_STORE_ADDRESS'),
    'payments.upiId': env('SEED_UPI_ID'),
    'payments.upiPayeeName': env('SEED_UPI_PAYEE_NAME'),
    'payments.bankName': env('SEED_BANK_NAME'),
    'payments.bankAccountName': env('SEED_BANK_ACCOUNT_NAME'),
    'payments.bankAccountNumber': env('SEED_BANK_ACCOUNT_NUMBER'),
    'payments.bankIfsc': env('SEED_BANK_IFSC'),
    'payments.bankBranch': env('SEED_BANK_BRANCH'),
  };
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value, updatedBy: 'seed' } });
  }
}

/** Imports the original UPI QR image into the database after verifying it decodes to a UPI URI. */
async function seedUpiQr() {
  const file = env('SEED_UPI_QR_PATH') ?? join(__dirname, '../../../public/payment/upi-qr/current-upi-qr.png');
  if (!existsSync(file)) return 'not found';
  if (await prisma.businessAsset.findUnique({ where: { key: 'upi-qr' } })) return 'kept existing';
  const data = readFileSync(file);
  const mimeType = sniffFileType(data);
  const uri = decodeQrImage(data);
  const payload = uri ? parseUpiUri(uri) : null;
  if (!mimeType || !payload) return 'skipped (file is not a readable UPI QR)';
  await prisma.businessAsset.create({
    data: {
      key: 'upi-qr',
      mimeType,
      data: toBytes(data),
      sha256: createHash('sha256').update(data).digest('hex'),
      decodedValue: uri,
      uploadedBy: 'seed',
    },
  });
  return `imported (pays ${payload.upiId})`;
}

const SUBCATEGORIES = [
  ['Rings', 'rings'],
  ['Earrings', 'earrings'],
  ['Necklaces', 'necklaces'],
  ['Pendants', 'pendants'],
  ['Bracelets', 'bracelets'],
  ['Bangles', 'bangles'],
  ['Chains', 'chains'],
  ['Nose Pins', 'nose-pins'],
  ['Anklets', 'anklets'],
  ['Bridal Sets', 'bridal-sets'],
] as const;

const COLLECTIONS = [
  { slug: 'new-arrivals', name: 'New Arrivals', rule: 'NEWEST', heroSubtitle: 'The latest pieces from our ateliers.' },
  { slug: 'bestsellers', name: 'Bestsellers', rule: 'BESTSELLING', heroSubtitle: 'The pieces our customers love most.' },
  { slug: 'bridal', name: 'Bridal Collection', rule: 'MANUAL', theme: 'burgundy', heroSubtitle: 'For your special day.' },
  { slug: 'wedding', name: 'Wedding Collection', rule: 'MANUAL', theme: 'burgundy', heroSubtitle: 'Two hearts, one story.' },
  { slug: 'festive', name: 'Festive Collection', rule: 'MANUAL', theme: 'emerald', heroSubtitle: 'Celebrate in style.' },
  { slug: 'limited', name: 'Limited Collection', rule: 'MANUAL', theme: 'charcoal', heroSubtitle: 'Exclusive designs, made in small numbers.' },
] as const;

const DRAFT_NOTICE =
  'DRAFT — This page contains placeholder wording and must be reviewed and approved by SeSha Stone Pvt. Ltd. (and legal counsel where appropriate) before launch. Text in [square brackets] needs company-specific details.';

function policy(title: string, body: string) {
  return { title, content: `${DRAFT_NOTICE}\n\n${body}` };
}

const PAGES: Record<string, { title: string; content: string }> = {
  about: {
    title: 'About SeSha Stone',
    content:
      'Where every stone tells a story.\n\nSeSha Stone Pvt. Ltd. is a modern Indian jewellery house offering gold, silver, diamond and premium artificial jewellery — designed for life\'s most beautiful moments, with timeless elegance at its heart.',
  },
  'privacy-policy': policy(
    'Privacy Policy',
    'This policy explains how SeSha Stone Pvt. Ltd. collects, uses and protects your personal information when you use www.seshastone.com.\n\nInformation we collect: name, email, mobile number, delivery and billing addresses, order history, and payment references (such as UTR numbers) you provide.\n\nWe do not ask for or store card numbers, CVV, UPI PINs, OTPs or banking passwords.\n\nHow we use it: to process and deliver orders, verify payments, provide customer support and — only with your consent — send offers.\n\nData retention, sharing with courier partners, your rights and grievance officer contact: [to be completed].',
  ),
  'terms-and-conditions': policy(
    'Terms and Conditions',
    'By using www.seshastone.com you agree to these terms.\n\nProducts and pricing: product descriptions, weights and prices are provided in good faith; prices include applicable GST unless stated otherwise.\n\nOrders are confirmed only after successful payment verification.\n\nGoverning law and jurisdiction: [to be completed].',
  ),
  'shipping-policy': policy(
    'Shipping Policy',
    'Delivery areas: [to be confirmed].\n\nDispatch time: [to be confirmed] business days after payment verification.\n\nShipping charges are shown at checkout before you pay.\n\nTracking details are shared once your order is shipped.',
  ),
  'cancellation-policy': policy(
    'Cancellation Policy',
    'Unpaid orders can be cancelled from your account at any time.\n\nPaid orders can be cancelled before dispatch by contacting customer support: [conditions to be confirmed].',
  ),
  'return-policy': policy(
    'Return Policy',
    'Eligible delivered orders can be returned within [number] days of delivery using "Request a return" on your order page.\n\nItems must be unused, with original packaging, tags and any certificates.\n\nNon-returnable items: [e.g. customised or engraved pieces — to be confirmed].',
  ),
  'refund-policy': policy(
    'Refund Policy',
    'Approved refunds are made to [the original payment method / your bank account] within [number] business days after the returned item passes inspection.\n\nYou will be notified when your refund is processed, with the transfer reference.',
  ),
  'payment-policy': policy(
    'Payment Policy',
    'We currently accept UPI and bank transfer (NEFT / IMPS).\n\nPayments made by UPI or bank transfer are verified manually against our bank statement. Your order is confirmed only after the payment is verified — an uploaded screenshot alone is not treated as proof of payment.\n\nAlways use your order number as the payment reference.\n\nSeSha Stone will never ask for your UPI PIN, OTP, card details or banking password.',
  ),
  'jewellery-care': {
    title: 'Jewellery Care',
    content:
      'Store each piece separately in a soft pouch or lined box to avoid scratches.\n\nPut jewellery on after perfume, lotions and hairspray, and remove it before swimming, bathing or exercise.\n\nWipe gently with a soft, dry cloth after wearing.\n\nSilver naturally tarnishes over time; a silver polishing cloth restores its shine.\n\nPremium artificial jewellery is plated — keep it away from water and chemicals to preserve the finish.',
  },
  faqs: policy(
    'Frequently Asked Questions',
    'How do I pay?\nChoose UPI or bank transfer at checkout. After paying, enter the UTR / transaction ID on your order page.\n\nWhen is my order confirmed?\nAfter we verify your payment against our bank statement.\n\nHow do I track my order?\nUse "Track Order" with your order number and email address.\n\nDelivery times and returns: [to be completed].',
  ),
};

async function seedCatalogueStructure() {
  for (const [i, [name, slug]] of SUBCATEGORIES.entries()) {
    await prisma.category.upsert({ where: { slug }, update: {}, create: { name, slug, sortOrder: i + 1 } });
  }
  for (const [i, c] of COLLECTIONS.entries()) {
    await prisma.collection.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        name: c.name,
        rule: c.rule,
        theme: 'theme' in c ? c.theme : null,
        heroTitle: c.name,
        heroSubtitle: c.heroSubtitle,
        sortOrder: i,
      },
    });
  }
}

async function seedPages() {
  const contactLines = [
    env('SEED_STORE_LEGAL_NAME'),
    env('SEED_STORE_EMAIL') && `Email: ${env('SEED_STORE_EMAIL')}`,
    env('SEED_STORE_PHONE') && `Phone: ${env('SEED_STORE_PHONE')}`,
    env('SEED_STORE_WHATSAPP') && `WhatsApp: ${env('SEED_STORE_WHATSAPP')}`,
    env('SEED_STORE_WEBSITE') && `Website: ${env('SEED_STORE_WEBSITE')}`,
  ].filter(Boolean);
  const pages = {
    ...PAGES,
    contact: {
      title: 'Contact Us',
      content: ['We would love to help you choose, size or customise a piece.', contactLines.join('\n')]
        .filter(Boolean)
        .join('\n\n'),
    },
  };
  for (const [slug, page] of Object.entries(pages)) {
    await prisma.cmsPage.upsert({
      where: { slug },
      update: {},
      create: { slug, title: page.title, content: page.content, isPublished: true },
    });
  }
}

/** Clearly-labelled demo data for local development only. */
async function seedDemoProducts() {
  const rings = await prisma.category.findUniqueOrThrow({ where: { slug: 'rings' } });
  const bridal = await prisma.collection.findUniqueOrThrow({ where: { slug: 'bridal' } });
  await prisma.product.upsert({
    where: { slug: 'ruby-solitaire-ring' },
    update: {},
    create: {
      name: 'Ruby Solitaire Ring',
      slug: 'ruby-solitaire-ring',
      description: '[DEMO PRODUCT — replace with real product data before launch.]',
      status: 'ACTIVE',
      line: 'GOLD',
      categoryId: rings.id,
      metal: 'GOLD',
      purity: '18K',
      gemstone: 'Ruby',
      isFeatured: true,
      tags: ['demo'],
      collections: { connect: { id: bridal.id } },
      variants: {
        create: ['12', '14', '16'].map((size) => ({
          sku: `DEMO-RR-18K-${size}`,
          title: `Size ${size} / 18K`,
          size,
          price: 4_850_000,
          compareAtPrice: 5_200_000,
          inventory: { create: { quantity: 3 } },
        })),
      },
    },
  });
}

async function main() {
  const admin = await seedAdmin();
  await seedSettings();
  const qr = await seedUpiQr();
  await seedCatalogueStructure();
  await seedPages();
  if (env('SEED_DEMO_PRODUCTS') === 'true') await seedDemoProducts();
  console.log(`Seeded. Admin login: ${admin}. UPI QR: ${qr}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

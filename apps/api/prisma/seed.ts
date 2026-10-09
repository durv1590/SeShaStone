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

/** Contact details shown in policies. They come from SEED_* in the untracked .env, never from code. */
interface Contact {
  legalName: string;
  website: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  grievanceOfficer?: string;
}

const lines = (...items: (string | false | undefined)[]) => items.filter(Boolean).join('\n');

/** Pages written in plain text: "## " starts a heading, lines starting with "- " form a list. */
function buildPages(c: Contact): Record<string, { title: string; content: string }> {
  const reachUs = lines(c.email && `- Email: ${c.email}`, c.phone && `- Phone: ${c.phone}`, c.whatsapp && `- WhatsApp: ${c.whatsapp}`);
  const grievance = [
    '## Grievance Officer',
    'In line with the Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023, you can raise any complaint or concern with our Grievance Officer:',
    lines(
      `- Name: ${c.grievanceOfficer ?? 'Grievance Officer'}`,
      `- Company: ${c.legalName}`,
      c.email && `- Email: ${c.email}`,
      c.phone && `- Phone: ${c.phone}`,
      c.address && `- Address: ${c.address}`,
    ),
    'We acknowledge every complaint within 48 hours and aim to resolve it within one month of receiving it.',
  ].join('\n\n');

  return {
    about: {
      title: 'About SeSha Stone',
      content:
        "Where every stone tells a story.\n\nSeSha Stone Pvt. Ltd. is a modern Indian jewellery house offering gold, silver, diamond and premium artificial jewellery — designed for life's most beautiful moments, with timeless elegance at its heart.",
    },

    'privacy-policy': {
      title: 'Privacy Policy',
      content: [
        `This policy explains how ${c.legalName} ("SeSha Stone", "we") collects, uses and protects your personal data when you use ${c.website}. We process personal data in accordance with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.`,
        '## What we collect',
        lines(
          '- Account details: your name, email address, mobile number and password (stored only in encrypted, hashed form).',
          '- Order details: delivery and billing addresses, the pieces you order and your order history.',
          '- Payment references: the UTR or transaction ID you enter and any payment screenshot or receipt you upload, so we can verify your payment.',
          '- Messages you send us, return requests and reviews you write.',
          '- Your email address, if you subscribe to our newsletter.',
        ),
        'We never ask for, and never store, card numbers, CVV, UPI PINs, OTPs or banking passwords. UPI and bank transfers happen entirely in your own banking or UPI app.',
        '## How we use it',
        lines(
          '- To process, verify, pack and deliver your orders, and to handle cancellations, returns and refunds.',
          '- To send order updates by email.',
          '- To answer your questions and provide customer support.',
          '- To meet our legal, tax and accounting obligations.',
          '- To send news and offers, only if you have subscribed. You can unsubscribe at any time.',
        ),
        '## Who we share it with',
        'We share only what is needed, with:',
        lines(
          '- Courier partners, who receive your name, delivery address and phone number to deliver your order.',
          '- Service providers who host our website and send our emails, under obligations to keep your data confidential.',
          '- Government or law-enforcement authorities, when the law requires it.',
        ),
        'We do not sell your personal data.',
        '## Cookies and browser storage',
        'Our website uses your browser\'s local storage to remember your shopping bag, your wishlist and that you are signed in. We do not use advertising or tracking cookies.',
        '## How long we keep it',
        'We keep your account details while your account is active. Order, invoice and payment records are kept for as long as Indian tax and company law requires (currently up to eight years), then deleted.',
        '## Your rights',
        'Under the Digital Personal Data Protection Act, 2023 you can:',
        lines(
          '- ask for a summary of the personal data we hold about you;',
          '- ask us to correct, complete or update it;',
          '- ask us to erase it, unless we must keep it by law;',
          '- withdraw consent you have given, for example to marketing emails;',
          '- nominate someone to exercise these rights for you;',
          '- raise a grievance with us, and then with the Data Protection Board of India.',
        ),
        reachUs ? `To exercise any of these rights, contact us:\n${reachUs}` : 'To exercise any of these rights, contact our Grievance Officer below.',
        '## Security',
        'Our website uses HTTPS encryption, passwords are stored only in hashed form, and access to your data is limited to staff who need it to serve you.',
        '## Children',
        'Our website is meant for adults. If you are under 18, please use it with the consent and supervision of a parent or guardian.',
        grievance,
        '## Changes to this policy',
        'We may update this policy from time to time. The date at the bottom of this page shows when it was last changed.',
      ].join('\n\n'),
    },

    'terms-and-conditions': {
      title: 'Terms and Conditions',
      content: [
        `${c.legalName} operates ${c.website}. These terms apply when you use the website or place an order, and by doing so you agree to them.`,
        '## Products',
        lines(
          '- We describe every piece as accurately as we can, including its metal, purity, weight, stones and finish.',
          '- Natural stones and handcrafted pieces can vary slightly in colour, shape and weight from the photographs. The invoice shows the actual details of the piece you receive.',
          '- Premium artificial jewellery is always clearly labelled as such. It is not gold, silver or diamond jewellery.',
        ),
        '## Prices',
        lines(
          '- Prices are in Indian Rupees (₹) and include applicable GST unless stated otherwise.',
          '- Shipping charges, if any, are shown at checkout before you pay.',
          '- If a piece is listed at an obviously wrong price because of an error, we may cancel the order and give you a full refund, even after you have paid.',
        ),
        '## Orders and payment',
        lines(
          '- Placing an order is an offer to buy. Your order is confirmed only after we have verified your payment.',
          '- Unpaid orders are cancelled automatically when the payment time shown on your order page runs out.',
          '- We may decline or cancel an order — for example if a piece is no longer available or a payment cannot be verified — and will refund any amount you have paid.',
          '- See our Payment Policy, Shipping Policy, Cancellation Policy, Return Policy and Refund Policy for details.',
        ),
        '## Your account',
        'Keep your password confidential. You are responsible for activity under your account, so tell us straight away if you think someone else has used it.',
        '## Intellectual property',
        `${c.legalName} owns all content on this website, including the SeSha Stone name, logo, designs, photographs and text. Do not copy or reuse it without our written permission.`,
        '## Liability',
        'To the extent permitted by law, our liability for any order is limited to the amount you paid for it. Nothing in these terms limits your rights under the Consumer Protection Act, 2019.',
        '## Governing law and jurisdiction',
        'These terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of the courts at New Delhi, India.',
        grievance,
        '## Changes to these terms',
        'We may update these terms from time to time. The version on this page when you place an order applies to that order.',
      ].join('\n\n'),
    },

    'shipping-policy': {
      title: 'Shipping Policy',
      content: [
        '## Where we deliver',
        'We deliver across India.',
        '## When your order ships',
        'We dispatch your order within 2–4 business days after your payment is verified. Every piece is packed securely and sent by insured courier.',
        '## Delivery time',
        'Delivery usually takes 3–7 business days after dispatch, depending on your location. Remote areas may take a little longer.',
        '## Shipping charges',
        'Any shipping charges are shown at checkout before you pay.',
        '## Tracking',
        'We email you the courier name and tracking number when your order ships. You can also follow it with "Track Order", using your order number and email address.',
        '## Receiving your order',
        'Please check that the outer packaging is intact before accepting the parcel. If it looks opened or tampered with, refuse the delivery and contact us straight away.',
      ].join('\n\n'),
    },

    'cancellation-policy': {
      title: 'Cancellation Policy',
      content: [
        '## Before you pay',
        'You can cancel an unpaid order at any time from your account. Unpaid orders are also cancelled automatically when the payment time shown on your order page runs out.',
        '## After you pay, before dispatch',
        `Contact us${c.email ? ` at ${c.email}` : ''}${c.phone ? ` or ${c.phone}` : ''} with your order number. We will cancel the order and refund you in full to your original payment method within 7 business days.`,
        '## After dispatch',
        'Once an order has been dispatched it can no longer be cancelled. You can return eligible pieces after delivery under our Return Policy.',
        '## Cancellations by us',
        'We may cancel an order if a piece becomes unavailable, if it was listed with an obvious pricing error, or if we cannot verify the payment. If you have paid, we will refund you in full.',
      ].join('\n\n'),
    },

    'return-policy': {
      title: 'Return Policy',
      content: [
        '## 7-day returns',
        'You can return an eligible piece within 7 days of delivery.',
        '## Conditions',
        'To be accepted, the piece must be:',
        lines(
          '- unused and unaltered, in its original condition;',
          '- returned with its original packaging, tags and invoice;',
          '- returned with any certificate that came with it (for example a hallmark or diamond certificate).',
        ),
        '## Pieces that cannot be returned',
        'Customised, personalised or engraved pieces cannot be returned.',
        '## How to return',
        lines(
          '- Sign in and open the order under My Orders.',
          '- Choose "Request a return" and tell us the reason.',
          '- We will review your request and send you instructions for returning the piece.',
        ),
        'If your piece arrived damaged, or isn\'t what you ordered, please let us know within the same 7 days and include photos.',
        '## After we receive it',
        'We inspect every returned piece. Once it passes inspection, we refund you as described in our Refund Policy. If it doesn\'t pass, we will contact you to explain why.',
      ].join('\n\n'),
    },

    'refund-policy': {
      title: 'Refund Policy',
      content: [
        '## When you get a refund',
        lines(
          '- When you cancel a paid order before it is dispatched.',
          '- When we cancel an order you have paid for.',
          '- When a returned piece passes inspection.',
        ),
        '## How and when',
        'We refund you to your original payment method — the UPI ID or bank account you paid from — within 7 business days of the cancellation, or of the returned piece passing inspection.',
        'We email you when the refund is made, with the transaction reference. Your bank may take a little longer to show it in your account.',
        '## Questions',
        reachUs ? `If you have not received a refund you were expecting, contact us with your order number:\n${reachUs}` : 'If you have not received a refund you were expecting, contact us with your order number.',
      ].join('\n\n'),
    },

    'payment-policy': {
      title: 'Payment Policy',
      content: [
        '## How you can pay',
        'We accept UPI and bank transfer (NEFT / IMPS). The payment details appear on your order page after you place your order.',
        '## Confirming your payment',
        lines(
          '- After paying, enter the UTR or transaction ID on your order page. You can also upload the payment screenshot or receipt.',
          '- We verify every payment against our bank statement. Your order is confirmed only after the payment is verified — a screenshot alone is not proof of payment.',
          '- Please pay within the time shown on your order page. Unpaid orders are cancelled automatically when it runs out.',
          '- Always use your order number as the payment reference.',
        ),
        '## Stay safe',
        'SeSha Stone will never ask for your UPI PIN, OTP, card details or banking password. Only pay to the UPI ID, QR code or bank account shown on your own order page.',
      ].join('\n\n'),
    },

    'jewellery-care': {
      title: 'Jewellery Care',
      content:
        'Store each piece separately in a soft pouch or lined box to avoid scratches.\n\nPut jewellery on after perfume, lotions and hairspray, and remove it before swimming, bathing or exercise.\n\nWipe gently with a soft, dry cloth after wearing.\n\nSilver naturally tarnishes over time; a silver polishing cloth restores its shine.\n\nPremium artificial jewellery is plated — keep it away from water and chemicals to preserve the finish.',
    },

    faqs: {
      title: 'Frequently Asked Questions',
      content: [
        '## How do I pay?',
        'Choose UPI or bank transfer at checkout. After paying, enter the UTR or transaction ID on your order page.',
        '## When is my order confirmed?',
        'As soon as we have verified your payment against our bank statement.',
        '## How soon will my order arrive?',
        'We dispatch within 2–4 business days after your payment is verified. Delivery usually takes a further 3–7 business days, depending on your location.',
        '## Do you deliver everywhere in India?',
        'Yes, we deliver across India.',
        '## How do I track my order?',
        'Use "Track Order" with your order number and email address. We also email you the tracking number when your order ships.',
        '## Can I cancel my order?',
        'Yes, until it is dispatched. Unpaid orders can be cancelled from your account; for paid orders, contact us. See our Cancellation Policy.',
        '## Can I return a piece?',
        'Yes, within 7 days of delivery, if it is unused and returned with its packaging, tags, invoice and any certificate. Customised or engraved pieces cannot be returned. See our Return Policy.',
        '## When will I get my refund?',
        'Within 7 business days, to the UPI ID or bank account you paid from. See our Refund Policy.',
        '## Is premium artificial jewellery real gold?',
        'No. Premium artificial jewellery is plated fashion jewellery and is always labelled as such.',
      ].join('\n\n'),
    },

    contact: {
      title: 'Contact Us',
      content: [
        'We would love to help you choose, size or customise a piece.',
        lines(
          c.legalName,
          c.email && `Email: ${c.email}`,
          c.phone && `Phone: ${c.phone}`,
          c.whatsapp && `WhatsApp: ${c.whatsapp}`,
          c.address && `Address: ${c.address}`,
          `Website: ${c.website}`,
        ),
        grievance,
      ].join('\n\n'),
    },
  };
}

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

/** The earlier seed wrote placeholder policies starting with this text; only those are replaced. */
const OLD_DRAFT_PREFIX = 'DRAFT —';

async function seedPages() {
  const pages = buildPages({
    legalName: env('SEED_STORE_LEGAL_NAME') ?? 'SeSha Stone Pvt. Ltd.',
    website: env('SEED_STORE_WEBSITE') ?? 'www.seshastone.com',
    email: env('SEED_STORE_EMAIL'),
    phone: env('SEED_STORE_PHONE'),
    whatsapp: env('SEED_STORE_WHATSAPP'),
    address: env('SEED_STORE_ADDRESS'),
    grievanceOfficer: env('SEED_GRIEVANCE_OFFICER_NAME'),
  });
  let replaced = 0;
  for (const [slug, page] of Object.entries(pages)) {
    const existing = await prisma.cmsPage.findUnique({ where: { slug } });
    if (!existing) {
      await prisma.cmsPage.create({ data: { slug, title: page.title, content: page.content, isPublished: true } });
    } else if (existing.content.startsWith(OLD_DRAFT_PREFIX)) {
      // Never overwrite a page someone has edited in Admin → Banners & CMS.
      await prisma.cmsPage.update({ where: { slug }, data: { title: page.title, content: page.content } });
      replaced++;
    }
  }
  return replaced;
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
  const pagesReplaced = await seedPages();
  if (env('SEED_DEMO_PRODUCTS') === 'true') await seedDemoProducts();
  console.log(`Seeded. Admin login: ${admin}. UPI QR: ${qr}. Draft pages replaced: ${pagesReplaced}.`);
  if (!env('SEED_GRIEVANCE_OFFICER_NAME')) console.warn('SEED_GRIEVANCE_OFFICER_NAME is not set: policy pages name the Grievance Officer only by title.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

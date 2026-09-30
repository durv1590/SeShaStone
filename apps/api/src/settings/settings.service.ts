import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { hasPermission } from '../common/auth/permissions';
import { Actor } from '../common/decorators/actor.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { sniffFileType, toBytes } from '../common/utils/file-type';
import { maskTail } from '../common/utils/mask';
import { decodeQrImage, parseUpiUri, sameUpiId, UpiPayload } from '../common/utils/upi-qr';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * The single source of business configuration. Every contact, bank, UPI and payment value the
 * site shows comes from here (database-backed, cached in Redis). Defaults apply until a key is
 * saved from Admin → Settings. Integration secrets (API keys, SMTP passwords) are NOT settings —
 * they live in server environment variables.
 */
export const SETTING_DEFAULTS = {
  // Business information
  'store.name': 'SeSha Stone',
  'store.legalName': 'SeSha Stone Pvt. Ltd.',
  'store.website': 'www.seshastone.com',
  'store.supportEmail': '',
  'store.supportPhone': '',
  'store.whatsapp': '',
  'store.address': '',
  'store.gstin': '',
  'store.announcement': '',
  'store.instagram': '',
  'store.facebook': '',
  'store.youtube': '',
  /** Trust messages shown site-wide. Only list claims your actual policies support. */
  'store.trustPoints': [
    'Authentic Jewellery',
    'Secure Online Shopping',
    'Pan India Delivery',
    'Easy Returns',
    'Dedicated Customer Support',
  ] as string[],

  // Shipping, checkout, returns
  'shipping.flatRate': 0, // paise
  'shipping.freeAbove': 0, // paise; 0 = always free
  'checkout.codEnabled': false,
  'checkout.pendingOrderTtlMinutes': 30,
  /** How long unpaid UPI / bank transfer orders hold stock before expiring. */
  'checkout.manualPaymentHoldHours': 48,
  'returns.windowDays': 7,

  // Payment methods: RAZORPAY | CASHFREE | UPI (via gateway) | UPI_DIRECT | BANK_TRANSFER
  'payments.enabledProviders': ['UPI_DIRECT', 'BANK_TRANSFER'] as string[],
  'payments.upiId': '',
  'payments.upiPayeeName': '',
  'payments.upiInstructions': '',
  /**
   * Off by default: show an amount-prefilled QR / "Open UPI app" link generated from the UPI ID.
   * Enable only after testing that it pays the right account.
   */
  'payments.upiGeneratedQrEnabled': false,
  'payments.bankName': '',
  'payments.bankAccountName': '',
  'payments.bankAccountNumber': '',
  'payments.bankIfsc': '',
  'payments.bankBranch': '',
  'payments.bankInstructions': '',
  'payments.refundInstructions': '',
};

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

/** Keys the storefront may read without authentication. Never add bank or UPI details here. */
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  'store.name',
  'store.legalName',
  'store.website',
  'store.supportEmail',
  'store.supportPhone',
  'store.whatsapp',
  'store.address',
  'store.announcement',
  'store.instagram',
  'store.facebook',
  'store.youtube',
  'store.trustPoints',
  'shipping.flatRate',
  'shipping.freeAbove',
  'checkout.codEnabled',
  'returns.windowDays',
  'payments.enabledProviders',
];

/** Values masked in admin screens and audit logs. */
export const SENSITIVE_KEYS: SettingKey[] = ['payments.bankAccountNumber'];

export const isPaymentKey = (key: string) => key.startsWith('payments.');

const PROVIDERS = ['RAZORPAY', 'CASHFREE', 'UPI', 'UPI_DIRECT', 'BANK_TRANSFER'];
const text = (max: number) => (v: unknown) => {
  if (typeof v !== 'string') throw new Error('must be text');
  const t = v.trim();
  if (t.length > max) throw new Error(`must be at most ${max} characters`);
  return t;
};
const optional = (re: RegExp, message: string, max = 200) => (v: unknown) => {
  const t = text(max)(v);
  if (t && !re.test(t)) throw new Error(message);
  return t;
};
const int = (min: number, max: number) => (v: unknown) => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`must be a whole number between ${min} and ${max}`);
  }
  return n;
};
const bool = (v: unknown) => {
  if (typeof v !== 'boolean') throw new Error('must be true or false');
  return v;
};
const url = optional(/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i, 'must be a web address');

const VALIDATORS: { [K in SettingKey]: (v: unknown) => unknown } = {
  'store.name': text(80),
  'store.legalName': text(120),
  'store.website': url,
  'store.supportEmail': optional(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'must be an email address'),
  'store.supportPhone': optional(/^\+?[\d\s-]{10,16}$/, 'must be a phone number'),
  'store.whatsapp': optional(/^\+?[\d\s-]{10,16}$/, 'must be a phone number'),
  'store.address': text(300),
  'store.gstin': optional(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'must be a valid 15-character GSTIN'),
  'store.announcement': text(160),
  'store.instagram': url,
  'store.facebook': url,
  'store.youtube': url,
  'store.trustPoints': (v) => {
    if (!Array.isArray(v) || v.length > 6) throw new Error('must be a list of up to 6 items');
    return v.map((x) => text(60)(x)).filter(Boolean);
  },
  'shipping.flatRate': int(0, 10_000_000),
  'shipping.freeAbove': int(0, 1_000_000_000),
  'checkout.codEnabled': bool,
  'checkout.pendingOrderTtlMinutes': int(5, 1440),
  'checkout.manualPaymentHoldHours': int(1, 336),
  'returns.windowDays': int(0, 90),
  'payments.enabledProviders': (v) => {
    if (!Array.isArray(v) || v.some((p) => !PROVIDERS.includes(p))) throw new Error(`must be a list of ${PROVIDERS.join(', ')}`);
    return [...new Set(v as string[])];
  },
  'payments.upiId': optional(/^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,64}$/, 'must be a UPI ID like name@bank'),
  'payments.upiPayeeName': text(100),
  'payments.upiInstructions': text(1000),
  'payments.upiGeneratedQrEnabled': bool,
  'payments.bankName': text(100),
  'payments.bankAccountName': text(100),
  'payments.bankAccountNumber': optional(/^\d{9,18}$/, 'must be 9–18 digits'),
  'payments.bankIfsc': (v) => optional(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'must be a valid 11-character IFSC')(String(v ?? '').toUpperCase()),
  'payments.bankBranch': text(150),
  'payments.bankInstructions': text(1000),
  'payments.refundInstructions': text(1000),
};

const CACHE_KEY = 'settings:all';
const QR_KEY = 'upi-qr';

export interface UpiQrInfo {
  present: boolean;
  mimeType?: string;
  sha256?: string;
  dataUrl?: string;
  decoded?: UpiPayload | null;
  matchesUpiId?: boolean;
  updatedAt?: Date;
  uploadedBy?: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async all(): Promise<Settings> {
    const cached = await this.redis.getJson<Settings>(CACHE_KEY);
    if (cached) return cached;
    const rows = await this.prisma.setting.findMany();
    const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
    for (const row of rows) if (row.key in SETTING_DEFAULTS) merged[row.key] = row.value;
    await this.redis.setJson(CACHE_KEY, merged, 300);
    return merged as Settings;
  }

  async get<K extends SettingKey>(key: K): Promise<Settings[K]> {
    return (await this.all())[key];
  }

  async publicSettings() {
    const all = await this.all();
    return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, all[k]]));
  }

  /** Admin view: sensitive values are masked; use reveal() to see one. */
  async adminView() {
    const all = await this.all();
    const view: Record<string, unknown> = { ...all };
    for (const k of SENSITIVE_KEYS) view[k] = maskTail(all[k] as string);
    const updated = await this.prisma.setting.findMany({ select: { key: true, updatedAt: true, updatedBy: true } });
    return { values: view, sensitiveKeys: SENSITIVE_KEYS, meta: Object.fromEntries(updated.map((u) => [u.key, u])) };
  }

  async reveal(actor: Actor, key: string) {
    if (!SENSITIVE_KEYS.includes(key as SettingKey)) throw new BadRequestException('Not a sensitive setting');
    await this.audit.record(actor, { action: 'settings.reveal', entityType: 'Setting', entityId: key });
    return { key, value: (await this.all())[key as SettingKey] };
  }

  /**
   * Saves changed values only. Payment keys need `settings.payment.edit` and an explicit
   * confirmation; every change is written to the audit log with sensitive values masked.
   */
  async update(actor: Actor, values: Record<string, unknown>, confirmFinancialChange = false) {
    const current = await this.all();
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    const errors: string[] = [];

    for (const [key, raw] of Object.entries(values)) {
      if (!(key in SETTING_DEFAULTS)) {
        errors.push(`${key}: unknown setting`);
        continue;
      }
      const k = key as SettingKey;
      // The masked placeholder coming back from the form means "unchanged".
      if (SENSITIVE_KEYS.includes(k) && raw === maskTail(current[k] as string)) continue;
      let value: unknown;
      try {
        value = VALIDATORS[k](raw);
      } catch (err) {
        errors.push(`${key}: ${(err as Error).message}`);
        continue;
      }
      if (JSON.stringify(value) !== JSON.stringify(current[k])) changes[k] = { before: current[k], after: value };
    }
    if (errors.length) throw new BadRequestException(errors);

    const keys = Object.keys(changes);
    if (!keys.length) return this.adminView();

    const paymentKeys = keys.filter(isPaymentKey);
    if (keys.some((k) => !isPaymentKey(k)) && !hasPermission(actor.role as Role, 'settings.business.edit')) {
      throw new ForbiddenException('You do not have permission to edit business settings');
    }
    if (paymentKeys.length && !hasPermission(actor.role as Role, 'settings.payment.edit')) {
      throw new ForbiddenException('You do not have permission to edit payment settings');
    }
    if (paymentKeys.length && !confirmFinancialChange) {
      throw new ConflictException({
        message: 'Please confirm the change to payment details',
        confirmationRequired: true,
        keys: paymentKeys,
      });
    }

    const masked = (k: string, v: unknown) => (SENSITIVE_KEYS.includes(k as SettingKey) ? maskTail(v as string) : v);
    await this.prisma.$transaction(async (tx) => {
      for (const k of keys) {
        const value = changes[k].after as Prisma.InputJsonValue;
        await tx.setting.upsert({
          where: { key: k },
          create: { key: k, value, updatedBy: actor.email },
          update: { value, updatedBy: actor.email },
        });
      }
      await this.audit.record(
        actor,
        {
          action: paymentKeys.length ? 'settings.payment.update' : 'settings.business.update',
          entityType: 'Setting',
          entityId: keys.join(','),
          before: Object.fromEntries(keys.map((k) => [k, masked(k, changes[k].before)])),
          after: Object.fromEntries(keys.map((k) => [k, masked(k, changes[k].after)])),
        },
        tx,
      );
    });
    await this.redis.del(CACHE_KEY);
    return this.adminView();
  }

  // ── UPI QR (original image, stored privately) ──────────────

  async upiQr(includeImage = true): Promise<UpiQrInfo> {
    const asset = await this.prisma.businessAsset.findUnique({ where: { key: QR_KEY } });
    if (!asset) return { present: false };
    const decoded = asset.decodedValue ? parseUpiUri(asset.decodedValue) : null;
    return {
      present: true,
      mimeType: asset.mimeType,
      sha256: asset.sha256,
      dataUrl: includeImage ? `data:${asset.mimeType};base64,${Buffer.from(asset.data).toString('base64')}` : undefined,
      decoded,
      matchesUpiId: sameUpiId(decoded?.upiId, await this.get('payments.upiId')),
      updatedAt: asset.updatedAt,
      uploadedBy: asset.uploadedBy,
    };
  }

  /**
   * Accepts the original UPI QR image. The file is decoded server-side and rejected unless it is
   * a readable `upi://pay` QR whose UPI ID matches the configured UPI ID. The image bytes are
   * stored unmodified.
   */
  async uploadUpiQr(actor: Actor, file: { buffer: Buffer; size: number } | undefined, confirm: boolean) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose a QR image to upload');
    if (file.size > 2 * 1024 * 1024) throw new BadRequestException('QR image must be 2 MB or smaller');
    const mimeType = sniffFileType(file.buffer);
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg') {
      throw new BadRequestException('QR image must be a PNG or JPEG file');
    }
    const uri = decodeQrImage(file.buffer);
    if (!uri) throw new BadRequestException('No QR code could be read from this image');
    const payload = parseUpiUri(uri);
    if (!payload) throw new BadRequestException('This QR code is not a UPI payment QR');
    const upiId = await this.get('payments.upiId');
    if (!sameUpiId(payload.upiId, upiId)) {
      throw new BadRequestException(
        `This QR pays ${payload.upiId}, but the UPI ID in settings is ${upiId || '(not set)'}. ` +
          'Upload the QR for the configured UPI ID, or update the UPI ID first.',
      );
    }
    if (!confirm) {
      throw new ConflictException({
        message: `Confirm: customers will pay ${payload.upiId}${payload.payeeName ? ` (${payload.payeeName})` : ''} using this QR`,
        confirmationRequired: true,
        decoded: payload,
      });
    }
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const before = await this.prisma.businessAsset.findUnique({ where: { key: QR_KEY }, select: { sha256: true, decodedValue: true } });
    await this.prisma.businessAsset.upsert({
      where: { key: QR_KEY },
      create: { key: QR_KEY, mimeType, data: toBytes(file.buffer), sha256, decodedValue: uri, uploadedBy: actor.email },
      update: { mimeType, data: toBytes(file.buffer), sha256, decodedValue: uri, uploadedBy: actor.email },
    });
    await this.audit.record(actor, {
      action: 'settings.upi_qr.upload',
      entityType: 'BusinessAsset',
      entityId: QR_KEY,
      before,
      after: { sha256, decodedValue: uri },
    });
    return this.upiQr();
  }

  async removeUpiQr(actor: Actor) {
    const before = await this.prisma.businessAsset.findUnique({ where: { key: QR_KEY }, select: { sha256: true, decodedValue: true } });
    if (!before) return { present: false };
    await this.prisma.businessAsset.delete({ where: { key: QR_KEY } });
    await this.audit.record(actor, { action: 'settings.upi_qr.remove', entityType: 'BusinessAsset', entityId: QR_KEY, before });
    return { present: false };
  }

  history(page = 1) {
    return this.audit.list(Object.assign(new PaginationDto(), { page, pageSize: 30, action: 'settings.' }));
  }
}

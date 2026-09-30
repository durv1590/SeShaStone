import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Defaults applied when a key has never been saved from the admin panel. */
export const SETTING_DEFAULTS = {
  'store.name': 'Se Sha Stone',
  'store.legalName': 'SeSha Stone Pvt. Ltd.',
  'store.website': 'www.seshastone.com',
  'store.supportEmail': '',
  'store.supportPhone': '',
  'store.gstin': '',
  'shipping.flatRate': 0, // paise
  'shipping.freeAbove': 0, // paise; 0 = always free
  'checkout.codEnabled': false,
  'checkout.pendingOrderTtlMinutes': 30,
  /** How long orders paid by direct UPI / bank transfer are held awaiting confirmation. */
  'checkout.manualPaymentHoldHours': 48,
  // RAZORPAY | CASHFREE | UPI (via gateway) | UPI_DIRECT | BANK_TRANSFER
  'payments.enabledProviders': ['UPI_DIRECT', 'BANK_TRANSFER'],
  'payments.upiId': '',
  'payments.upiPayeeName': '',
  'payments.bankName': '',
  'payments.bankAccountName': '',
  'payments.bankAccountNumber': '',
  'payments.bankIfsc': '',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Keys the storefront may read without authentication. */
export const PUBLIC_SETTING_KEYS: SettingKey[] = [
  'store.name',
  'store.legalName',
  'store.website',
  'store.supportEmail',
  'store.supportPhone',
  'shipping.flatRate',
  'shipping.freeAbove',
  'checkout.codEnabled',
  'payments.enabledProviders',
];

const CACHE_KEY = 'settings:all';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async all(): Promise<Record<string, unknown>> {
    const cached = await this.redis.getJson<Record<string, unknown>>(CACHE_KEY);
    if (cached) return cached;
    const rows = await this.prisma.setting.findMany();
    const merged: Record<string, unknown> = { ...SETTING_DEFAULTS };
    for (const row of rows) merged[row.key] = row.value;
    await this.redis.setJson(CACHE_KEY, merged, 300);
    return merged;
  }

  async get<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
    const all = await this.all();
    return all[key] as (typeof SETTING_DEFAULTS)[K];
  }

  async publicSettings() {
    const all = await this.all();
    return Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, all[k]]));
  }

  async update(values: Record<string, unknown>) {
    await this.prisma.$transaction(
      Object.entries(values).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
    );
    await this.redis.del(CACHE_KEY);
    return this.all();
  }
}

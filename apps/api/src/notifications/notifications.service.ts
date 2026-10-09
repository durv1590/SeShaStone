import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { OrderContext, TEMPLATES } from './templates';

export interface SendInput {
  template: keyof typeof TEMPLATES | string;
  to: string | null | undefined;
  context: OrderContext;
  customerId?: string | null;
  orderId?: string | null;
}

/**
 * Sends transactional email when SMTP is configured. Every attempt is recorded in the
 * Notification table; without a provider the record says SKIPPED — never "sent".
 */
export interface EmailStatus {
  configured: boolean;
  host: string | null;
  from: string | null;
  /** Result of the last connection check: null until one has run. */
  connection: { ok: boolean; checkedAt: string; error: string | null } | null;
  warnings: string[];
}

/** The address part of a From header such as `SeSha Stone <shop@gmail.com>`. */
export const fromAddress = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transport: Transporter | null;
  private readonly from: string | undefined;
  private readonly host: string | undefined;
  private readonly user: string | undefined;
  private connection: EmailStatus['connection'] = null;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const host = config.get<string>('smtp.host');
    this.host = host;
    this.user = config.get<string>('smtp.user');
    this.from = config.get<string>('smtp.from');
    this.transport = host
      ? createTransport({
          host,
          port: config.get<number>('smtp.port'),
          secure: config.get<boolean>('smtp.secure'),
          auth: config.get<string>('smtp.user')
            ? { user: config.get<string>('smtp.user'), pass: config.get<string>('smtp.pass') }
            : undefined,
        })
      : null;
  }

  get emailConfigured() {
    return !!this.transport && !!this.from;
  }

  /** Checks the SMTP login at startup so a wrong password shows up in the logs, not on the first order. */
  async onModuleInit() {
    if (!this.emailConfigured) return this.logger.warn('Email is not configured (SMTP_*): notifications will be recorded as SKIPPED.');
    for (const w of this.warnings()) this.logger.warn(w);
    await this.checkConnection();
    if (this.connection?.ok) this.logger.log(`Email ready: sending through ${this.host} as ${this.from}`);
    else this.logger.warn(`Email login failed (${this.host}): ${this.connection?.error}`);
  }

  async checkConnection() {
    if (!this.transport) return null;
    try {
      await this.transport.verify();
      this.connection = { ok: true, checkedAt: new Date().toISOString(), error: null };
    } catch (err) {
      this.connection = { ok: false, checkedAt: new Date().toISOString(), error: (err as Error).message.slice(0, 300) };
    }
    return this.connection;
  }

  /** Configuration problems that would make mail fail or land in spam. */
  warnings(): string[] {
    const out: string[] = [];
    if (this.host && !this.from) out.push('SMTP_FROM is not set, so no email can be sent.');
    // Gmail rewrites any other From address to the signed-in account, so make the mismatch visible.
    if (this.host === 'smtp.gmail.com' && this.from && this.user && fromAddress(this.from) !== this.user.trim().toLowerCase()) {
      out.push(`SMTP_FROM (${fromAddress(this.from)}) differs from SMTP_USER (${this.user}). Gmail will send as ${this.user}; set SMTP_FROM to that address.`);
    }
    return out;
  }

  status(): EmailStatus {
    return {
      configured: this.emailConfigured,
      host: this.host ?? null,
      from: this.from ?? null,
      connection: this.connection,
      warnings: this.warnings(),
    };
  }

  /** Fire-and-forget: never blocks or fails the business operation that triggered it. */
  notify(input: SendInput) {
    void this.send(input).catch((err) => this.logger.warn(`Notification failed: ${err.message}`));
  }

  async send(input: SendInput) {
    const template = TEMPLATES[input.template];
    if (!template || !input.to) return null;
    const { subject, text } = template(input.context);
    let status: 'SENT' | 'SKIPPED' | 'FAILED' = 'SKIPPED';
    let error: string | null = this.emailConfigured ? null : 'No email provider configured (SMTP_* not set)';

    if (this.emailConfigured) {
      try {
        await this.transport!.sendMail({ from: this.from, to: input.to, subject, text });
        status = 'SENT';
      } catch (err) {
        status = 'FAILED';
        error = (err as Error).message.slice(0, 500);
      }
    }

    return this.prisma.notification.create({
      data: {
        channel: 'EMAIL',
        template: input.template,
        recipient: input.to,
        subject,
        status,
        error,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
      },
    });
  }

  /** Sends a test email so staff can confirm the provider works. Recorded like any other notification. */
  async sendTest(to: string) {
    const subject = 'SeSha Stone test email';
    const text = `This is a test email from the SeSha Stone admin panel.\n\nIf you can read this, order emails will be delivered from ${this.from ?? 'the store'}.\n\n— SeSha Stone\nTimeless Elegance`;
    let result: { ok: boolean; error: string | null };
    if (!this.emailConfigured) {
      result = { ok: false, error: 'No email provider configured (SMTP_* not set)' };
    } else {
      try {
        await this.transport!.sendMail({ from: this.from, to, subject, text });
        result = { ok: true, error: null };
        this.connection = { ok: true, checkedAt: new Date().toISOString(), error: null };
      } catch (err) {
        result = { ok: false, error: (err as Error).message.slice(0, 500) };
      }
    }
    await this.prisma.notification.create({
      data: {
        channel: 'EMAIL',
        template: 'test',
        recipient: to,
        subject,
        status: result.ok ? 'SENT' : this.emailConfigured ? 'FAILED' : 'SKIPPED',
        error: result.error,
      },
    });
    return result;
  }

  forOrder(orderId: string) {
    return this.prisma.notification.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }
}

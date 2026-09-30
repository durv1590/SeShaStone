import { Injectable, Logger } from '@nestjs/common';
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
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly transport: Transporter | null;
  private readonly from: string | undefined;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const host = config.get<string>('smtp.host');
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

  forOrder(orderId: string) {
    return this.prisma.notification.findMany({ where: { orderId }, orderBy: { createdAt: 'desc' } });
  }
}

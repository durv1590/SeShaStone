import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { fromAddress, NotificationsService } from './notifications.service';

const make = (smtp: Record<string, unknown>) => {
  const config = { get: (key: string) => smtp[key.replace('smtp.', '')] } as unknown as ConfigService;
  return new NotificationsService(config, {} as PrismaService);
};

describe('fromAddress', () => {
  it('extracts the address from a display-name From header', () => {
    expect(fromAddress('SeSha Stone <Shop@Gmail.com>')).toBe('shop@gmail.com');
    expect(fromAddress('shop@gmail.com')).toBe('shop@gmail.com');
  });
});

describe('NotificationsService email status', () => {
  it('reports not configured without SMTP_HOST', () => {
    const s = make({});
    expect(s.status()).toMatchObject({ configured: false, host: null, warnings: [] });
  });

  it('warns when a Gmail From address differs from the signed-in account', () => {
    const s = make({ host: 'smtp.gmail.com', port: 465, secure: true, user: 'shop@gmail.com', pass: 'x', from: 'SeSha Stone <orders@seshastone.com>' });
    expect(s.warnings()).toHaveLength(1);
    expect(s.warnings()[0]).toContain('Gmail will send as shop@gmail.com');
  });

  it('accepts a Gmail From that matches the account', () => {
    const s = make({ host: 'smtp.gmail.com', port: 465, secure: true, user: 'Shop@gmail.com', pass: 'x', from: 'SeSha Stone <shop@gmail.com>' });
    expect(s.warnings()).toEqual([]);
    expect(s.status().configured).toBe(true);
  });

  it('warns when SMTP_FROM is missing', () => {
    expect(make({ host: 'smtp.example.com', port: 587 }).warnings()).toEqual(['SMTP_FROM is not set, so no email can be sent.']);
  });
});

import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Customer, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { permissionsFor } from '../common/auth/permissions';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto, ResetPasswordDto } from './dto/auth.dto';

const RESET_TTL_MS = 30 * 60_000;
/** Compared against when the email is unknown, to keep login timing uniform. */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 12);
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const exists = await this.prisma.customer.findUnique({ where: { email } });
    if (exists) throw new ConflictException('An account with this email already exists');

    const customer = await this.prisma.customer.create({
      data: {
        email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
    });
    return this.issueToken(customer);
  }

  async login(dto: LoginDto, allowedRoles?: Role[]) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    // Always run bcrypt so response time doesn't reveal whether the email exists.
    const hash = customer?.passwordHash ?? DUMMY_HASH;
    const valid = (await bcrypt.compare(dto.password, hash)) && !!customer?.isActive;
    if (!customer || !valid || (allowedRoles && !allowedRoles.includes(customer.role))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueToken(customer);
  }

  /** Always succeeds from the caller's point of view, so it can't be used to discover accounts. */
  async forgotPassword(email: string) {
    const customer = await this.prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
    if (customer?.isActive) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.passwordResetToken.create({
        data: { customerId: customer.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
      });
      const link = `${this.config.get<string>('webUrl')}/reset-password?token=${token}`;
      await this.notifications.send({
        template: 'auth.password_reset',
        to: customer.email,
        customerId: customer.id,
        context: { orderNumber: '', total: 0, customerName: customer.firstName, link },
      });
      if (!this.notifications.emailConfigured && process.env.NODE_ENV === 'development') {
        // Local development only — lets developers test the flow without an email provider.
        this.logger.warn(`[dev] Password reset link for ${customer.email}: ${link}`);
      }
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired');
    }
    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id: record.customerId },
        data: { passwordHash: await bcrypt.hash(dto.password, 12) },
      }),
      // Invalidate this and any other outstanding tokens for the account.
      this.prisma.passwordResetToken.updateMany({
        where: { customerId: record.customerId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  async me(userId: string) {
    const c = await this.prisma.customer.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true },
    });
    return { ...c, permissions: permissionsFor(c.role) };
  }

  private async issueToken(customer: Customer) {
    const accessToken = await this.jwt.signAsync({
      sub: customer.id,
      email: customer.email,
      role: customer.role,
    });
    return {
      accessToken,
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        role: customer.role,
        permissions: permissionsFor(customer.role),
      },
    };
  }
}

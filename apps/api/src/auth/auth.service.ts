import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Customer, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
    const valid = customer?.isActive && (await bcrypt.compare(dto.password, customer.passwordHash));
    if (!customer || !valid || (allowedRoles && !allowedRoles.includes(customer.role))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueToken(customer);
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
      },
    };
  }
}

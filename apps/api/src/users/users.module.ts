import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { permissionsFor, STAFF_ROLES } from '../common/auth/permissions';
import { Actor, CurrentActor } from '../common/decorators/actor.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

class CreateStaffDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(80) firstName: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsEnum(Role) role: Role;
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{10,128}$/, {
    message: 'temporary password must be 10+ characters with a letter and a number',
  })
  password: string;
}

class UpdateStaffDto {
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

const staffSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.customer.findMany({
      where: { role: { in: STAFF_ROLES } },
      select: staffSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  roles() {
    return STAFF_ROLES.map((role) => ({ role, permissions: permissionsFor(role) }));
  }

  async create(actor: Actor, dto: CreateStaffDto) {
    if (dto.role === 'CUSTOMER') throw new BadRequestException('Choose a staff role');
    const email = dto.email.toLowerCase();
    if (await this.prisma.customer.findUnique({ where: { email } })) {
      throw new ConflictException('An account with this email already exists');
    }
    const user = await this.prisma.customer.create({
      data: {
        email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      select: staffSelect,
    });
    await this.audit.record(actor, { action: 'user.create', entityType: 'User', entityId: user.id, after: { email, role: dto.role } });
    return user;
  }

  async update(actor: Actor, id: string, dto: UpdateStaffDto) {
    if (id === actor.id) throw new ForbiddenException('You cannot change your own role or access');
    const before = await this.prisma.customer.findUniqueOrThrow({ where: { id }, select: staffSelect });
    if (dto.role === 'SUPER_ADMIN' || before.role === 'SUPER_ADMIN') {
      if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenException('Only a Super Admin can do this');
    }
    // Never leave the store without an active Super Admin.
    if (before.role === 'SUPER_ADMIN' && (dto.role !== undefined && dto.role !== 'SUPER_ADMIN' || dto.isActive === false)) {
      const others = await this.prisma.customer.count({ where: { role: 'SUPER_ADMIN', isActive: true, id: { not: id } } });
      if (!others) throw new BadRequestException('At least one active Super Admin is required');
    }
    const after = await this.prisma.customer.update({ where: { id }, data: dto, select: staffSelect });
    await this.audit.record(actor, {
      action: 'user.update',
      entityType: 'User',
      entityId: id,
      before: { role: before.role, isActive: before.isActive },
      after: { role: after.role, isActive: after.isActive },
    });
    return after;
  }
}

@ApiTags('users')
@ApiBearerAuth()
@RequirePermissions('users.manage')
@Controller('admin/users')
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('roles')
  roles() {
    return this.users.roles();
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() dto: CreateStaffDto) {
    return this.users.create(actor, dto);
  }

  @Patch(':id')
  update(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.users.update(actor, id, dto);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}

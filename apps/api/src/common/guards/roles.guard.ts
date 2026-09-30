import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { hasPermission, Permission } from '../auth/permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    const permissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, targets);
    if (!roles?.length && !permissions?.length) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (roles?.length && !roles.includes(user.role)) return false;
    return (permissions ?? []).every((p) => hasPermission(user.role, p));
  }
}

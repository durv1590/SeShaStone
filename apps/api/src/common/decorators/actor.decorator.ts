import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';

/** Who performed an action, plus request metadata for the audit trail. */
export interface Actor {
  id: string;
  email: string;
  role: Role;
  ip?: string;
  userAgent?: string;
}

export const CurrentActor = createParamDecorator((_: unknown, ctx: ExecutionContext): Actor => {
  const req = ctx.switchToHttp().getRequest<Request & { user: Actor }>();
  return {
    id: req.user?.id,
    email: req.user?.email,
    role: req.user?.role,
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, 300),
  };
});

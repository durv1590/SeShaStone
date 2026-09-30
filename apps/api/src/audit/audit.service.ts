import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Actor } from '../common/decorators/actor.decorator';
import { paginated, PaginationDto } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Append-only audit trail for administrative and financial actions.
 * Callers are responsible for masking sensitive values before passing them in.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(actor: Partial<Actor> | null, entry: AuditEntry, db: Db = this.prisma) {
    try {
      await db.auditLog.create({
        data: {
          actorId: actor?.id,
          actorEmail: actor?.email,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
          after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
          ip: actor?.ip,
          userAgent: actor?.userAgent,
        },
      });
    } catch (err) {
      // Inside a transaction the error must propagate so the change is rolled back.
      if (db !== this.prisma) throw err;
      this.logger.error(`Failed to write audit log for ${entry.action}: ${(err as Error).message}`);
    }
  }

  async list(query: PaginationDto & { entityType?: string; entityId?: string; action?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.action && { action: { startsWith: query.action } }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, query);
  }
}

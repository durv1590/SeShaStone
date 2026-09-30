import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { AuditService } from './audit.service';

class ListAuditDto extends PaginationDto {
  @IsOptional() @IsString() entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() action?: string;
}

@ApiTags('audit')
@ApiBearerAuth()
@Controller('admin/audit-logs')
class AuditController {
  constructor(private readonly audit: AuditService) {}

  @RequirePermissions('audit.view')
  @Get()
  list(@Query() query: ListAuditDto) {
    return this.audit.list(query);
  }
}

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

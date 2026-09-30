import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Actor, CurrentActor } from '../common/decorators/actor.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { EVIDENCE_MAX_BYTES, ManualPaymentsService } from './manual-payments.service';
import {
  CreateRefundDto,
  InitiatePaymentDto,
  ListPaymentsDto,
  ListRefundsDto,
  RejectPaymentDto,
  SubmitPaymentReferenceDto,
  UpdateRefundDto,
  VerifyPaymentDto,
} from './payments.dto';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';

function sendFile(res: Response, file: { data: Uint8Array; mimeType: string; fileName: string }) {
  res.set({
    'Content-Type': file.mimeType,
    'Content-Disposition': `inline; filename="${file.fileName.replace(/"/g, '')}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
  });
  return new StreamableFile(Buffer.from(file.data));
}

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly manual: ManualPaymentsService,
    private readonly refunds: RefundsService,
  ) {}

  // ── Gateway (future / optional) ────────────────────────────

  @ApiBearerAuth()
  @Post('payments/initiate')
  initiate(@CurrentUser() user: AuthUser, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiate(user.id, dto);
  }

  @ApiBearerAuth()
  @Post('payments/verify')
  @HttpCode(200)
  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) {
    return this.payments.verify(user.id, dto);
  }

  /** Gateway → server webhooks: /api/v1/payments/webhooks/razorpay | cashfree */
  @Public()
  @ApiExcludeEndpoint()
  @Post('payments/webhooks/:provider')
  @HttpCode(200)
  webhook(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ) {
    return this.payments.handleWebhook(provider.toUpperCase(), req.rawBody, headers);
  }

  // ── Direct UPI / bank transfer (customer) ──────────────────

  @ApiBearerAuth()
  @Get('me/orders/:id/payment-instructions')
  instructions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.manual.instructions(user.id, id);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('me/orders/:id/payment-reference')
  @HttpCode(200)
  submitReference(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SubmitPaymentReferenceDto) {
    return this.manual.submitReference(user.id, id, dto.reference);
  }

  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('me/orders/:id/payment-evidence')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: EVIDENCE_MAX_BYTES + 1, files: 1 } }))
  uploadEvidence(@CurrentUser() user: AuthUser, @Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.manual.uploadEvidence(user.id, id, file);
  }

  @ApiBearerAuth()
  @Get('me/payment-evidence/:evidenceId')
  async myEvidence(@CurrentUser() user: AuthUser, @Param('evidenceId') id: string, @Res({ passthrough: true }) res: Response) {
    return sendFile(res, await this.manual.evidenceFile(id, user.id));
  }

  // ── Admin ──────────────────────────────────────────────────

  @ApiBearerAuth()
  @RequirePermissions('payments.view')
  @Get('admin/payments')
  adminList(@Query() query: ListPaymentsDto) {
    return this.payments.adminList(query);
  }

  @ApiBearerAuth()
  @RequirePermissions('payments.view')
  @Get('admin/payment-evidence/:evidenceId')
  async adminEvidence(@Param('evidenceId') id: string, @Res({ passthrough: true }) res: Response) {
    return sendFile(res, await this.manual.evidenceFile(id, null));
  }

  @ApiBearerAuth()
  @RequirePermissions('payments.verify')
  @Post('admin/payments/:id/verify')
  @HttpCode(200)
  verifyManual(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.manual.verify(actor, id);
  }

  @ApiBearerAuth()
  @RequirePermissions('payments.verify')
  @Post('admin/payments/:id/reject')
  @HttpCode(200)
  reject(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.manual.reject(actor, id, dto.reason);
  }

  @ApiBearerAuth()
  @RequirePermissions('refunds.manage')
  @Get('admin/refunds')
  listRefunds(@Query() query: ListRefundsDto) {
    return this.refunds.list(query);
  }

  @ApiBearerAuth()
  @RequirePermissions('refunds.manage')
  @Post('admin/orders/:id/refunds')
  createRefund(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: CreateRefundDto) {
    return this.refunds.create(actor, id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions('refunds.manage')
  @Patch('admin/refunds/:id')
  updateRefund(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateRefundDto) {
    return this.refunds.update(actor, id, dto);
  }
}

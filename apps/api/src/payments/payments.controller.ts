import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  InitiatePaymentDto,
  ListPaymentsDto,
  RejectPaymentDto,
  SubmitPaymentReferenceDto,
  VerifyPaymentDto,
} from './payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

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

  @ApiBearerAuth()
  @Get('me/orders/:id/payment-instructions')
  instructions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.instructions(user.id, id);
  }

  @ApiBearerAuth()
  @Post('me/orders/:id/payment-reference')
  @HttpCode(200)
  submitReference(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitPaymentReferenceDto,
  ) {
    return this.payments.submitReference(user.id, id, dto);
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

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/payments')
  adminList(@Query() query: ListPaymentsDto) {
    return this.payments.adminList(query);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('admin/payments/:id/confirm')
  @HttpCode(200)
  confirm(@Param('id') id: string) {
    return this.payments.adminConfirm(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('admin/payments/:id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.payments.adminReject(id, dto.reason);
  }
}

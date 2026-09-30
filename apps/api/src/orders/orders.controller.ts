import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Actor, CurrentActor } from '../common/decorators/actor.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  CheckoutDto,
  ListOrdersDto,
  QuoteDto,
  ReturnRequestDto,
  TrackOrderDto,
  UpdateOrderStatusDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout/quote')
  @HttpCode(200)
  async quote(@CurrentUser() user: AuthUser, @Body() dto: QuoteDto) {
    const { coupon, ...quote } = await this.orders.quote(user.id, dto.items, dto.couponCode);
    return { ...quote, couponCode: coupon?.code ?? null };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  /** Public tracking — rate-limited to stop order-number guessing. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('orders/track')
  @HttpCode(200)
  track(@Body() dto: TrackOrderDto) {
    return this.orders.track(dto.orderNumber, dto.email);
  }

  @Get('me/orders')
  listMine(@CurrentUser() user: AuthUser, @Query() query: ListOrdersDto) {
    return this.orders.listMine(user.id, query);
  }

  @Get('me/orders/:id')
  findMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.findMine(user.id, id);
  }

  @Post('me/orders/:id/cancel')
  @HttpCode(200)
  cancelMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.cancelMine(user.id, id);
  }

  @Post('me/orders/:id/return')
  @HttpCode(200)
  requestReturn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReturnRequestDto) {
    return this.orders.requestReturn(user.id, id, dto.reason);
  }

  @RequirePermissions('orders.view')
  @Get('admin/orders')
  adminList(@Query() query: ListOrdersDto) {
    return this.orders.adminList(query);
  }

  @RequirePermissions('dashboard.view')
  @Get('admin/dashboard')
  stats() {
    return this.orders.stats();
  }

  @RequirePermissions('orders.view')
  @Get('admin/orders/:id')
  adminGet(@Param('id') id: string) {
    return this.orders.adminGet(id);
  }

  @RequirePermissions('orders.manage')
  @Patch('admin/orders/:id/status')
  updateStatus(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.adminUpdateStatus(actor, id, dto);
  }
}
